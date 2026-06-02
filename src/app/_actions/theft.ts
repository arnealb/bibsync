"use server";

import { getAuthContext } from "@/lib/auth";
import { awardBibcoins, spendBibcoins } from "@/lib/bibcoins/award";
import { getBibcoins } from "@/lib/bibcoins/queries";
import { copy } from "@/lib/copy";
import {
  CAUGHT_MULTIPLIER,
  FALSE_CLAIM_PENALTY,
  OPEN_THEFT_TTL_MS,
  STEAL_COOLDOWN_MS,
  THEFT_REASON_PREFIX,
} from "@/lib/theft/config";
import type { ClaimResult, StealResult } from "@/lib/theft/types";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import { stealSchema, type StealInput } from "@/lib/validation/theft";

/**
 * Read any user's wallet balance with the service role. `getBibcoins` uses the
 * caller's session, which RLS scopes to *their own* wallet — reading someone
 * else's that way returns the default, breaking the steal/claim math.
 */
async function walletBalance(
  admin: SupabaseClient,
  userId: string,
): Promise<number> {
  const { data } = await admin
    .from("wallets")
    .select("bibcoins")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.bibcoins ?? 0;
}

/** Steal coins from another member. The coins move immediately. */
export async function stealCoins(input: StealInput): Promise<StealResult> {
  const parsed = stealSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: copy.common.genericError };
  const { victimId, amount } = parsed.data;

  const ctx = await getAuthContext();
  if (!ctx) return { ok: false, error: copy.common.notAuthenticated };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: copy.theft.unavailable };
  const thiefId = ctx.user.id;

  if (victimId === thiefId) {
    return { ok: false, error: copy.theft.notYourself };
  }

  const { data: victim } = await admin
    .from("profiles")
    .select("id")
    .eq("id", victimId)
    .maybeSingle();
  if (!victim) return { ok: false, error: copy.common.genericError };

  // Anti-spam: one steal per cooldown window (any victim).
  const since = new Date(Date.now() - STEAL_COOLDOWN_MS).toISOString();
  const { data: recent } = await admin
    .from("thefts")
    .select("id")
    .eq("thief_id", thiefId)
    .gte("created_at", since)
    .limit(1);
  if (recent && recent.length > 0) {
    return { ok: false, error: copy.theft.cooldown };
  }

  // One open theft per (thief, victim) pair, but only while it's fresh —
  // a pending theft older than OPEN_THEFT_TTL_MS no longer blocks a new steal.
  const openSince = new Date(Date.now() - OPEN_THEFT_TTL_MS).toISOString();
  const { data: open } = await admin
    .from("thefts")
    .select("id")
    .eq("thief_id", thiefId)
    .eq("victim_id", victimId)
    .eq("status", "pending")
    .gte("created_at", openSince)
    .limit(1);
  if (open && open.length > 0) {
    return { ok: false, error: copy.theft.alreadyOpen };
  }

  const victimBalance = await walletBalance(admin, victimId);
  if (amount > victimBalance) {
    return { ok: false, error: copy.theft.victimBroke };
  }

  // Move the coins: debit the victim, credit the thief.
  const ref = `theft:${thiefId}:${victimId}:${crypto.randomUUID()}`;
  const taken = await spendBibcoins(victimId, amount, "theft_loss", ref);
  if (!taken) return { ok: false, error: copy.theft.victimBroke };
  const given = await awardBibcoins(thiefId, amount, "theft_gain", ref);
  if (!given) {
    // Could not credit the thief — give the victim their coins back.
    await awardBibcoins(victimId, amount, "theft_loss_refund", ref);
    return { ok: false, error: copy.common.genericError };
  }

  const { error } = await admin.from("thefts").insert({
    thief_id: thiefId,
    victim_id: victimId,
    amount,
  });
  if (error) {
    console.error("[stealCoins]", error);
    // Roll the coins back so a failed record doesn't strand the theft.
    await spendBibcoins(thiefId, amount, "theft_gain_refund", ref);
    await awardBibcoins(victimId, amount, "theft_loss_refund", ref);
    // A pre-0059 DB still has the one-pending-per-pair unique index; surface the
    // accurate "already open" message instead of a generic error.
    return {
      ok: false,
      error: error.code === "23505" ? copy.theft.alreadyOpen : copy.common.genericError,
    };
  }

  return { ok: true, balance: await getBibcoins(thiefId) };
}

/**
 * Claim "ik ben bestolen". Pays back 2× any theft you claim in time (before
 * your next spend); too late earns nothing; a claim with no theft at all costs
 * the false-claim penalty, which goes to the casino fund.
 */
export async function claimRobbed(): Promise<ClaimResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { ok: false, error: copy.common.notAuthenticated };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: copy.theft.unavailable };
  const victimId = ctx.user.id;

  const { data: pending, error: pendingError } = await admin
    .from("thefts")
    .select("id, thief_id, amount, created_at")
    .eq("victim_id", victimId)
    .eq("status", "pending");

  // Don't charge a penalty if we couldn't even read the table.
  if (pendingError) {
    console.error("[claimRobbed]", pendingError);
    return { ok: false, error: copy.theft.unavailable };
  }

  // No theft on record → false claim → penalty to the casino.
  if (!pending || pending.length === 0) {
    const balance = await getBibcoins(victimId);
    const charge = Math.min(FALSE_CLAIM_PENALTY, balance);
    if (charge > 0) {
      await spendBibcoins(
        victimId,
        charge,
        "theft_false_claim",
        `false:${victimId}:${crypto.randomUUID()}`,
      );
    }
    return {
      ok: true,
      kind: "penalty",
      amount: charge,
      balance: await getBibcoins(victimId),
    };
  }

  // A theft is claimable only if the victim hasn't spent since (the steal's own
  // debit and other theft-internal rows don't count as a spend).
  const claimable: { id: string; thiefId: string; amount: number }[] = [];
  const expired: string[] = [];
  for (const t of pending) {
    const { data: spends } = await admin
      .from("bibcoin_transactions")
      .select("reason")
      .eq("user_id", victimId)
      .lt("amount", 0)
      .gt("created_at", t.created_at);
    const spentSince = (spends ?? []).some(
      (s) => !s.reason.startsWith(THEFT_REASON_PREFIX),
    );
    if (spentSince) expired.push(t.id);
    else claimable.push({ id: t.id, thiefId: t.thief_id, amount: t.amount });
  }

  if (expired.length > 0) {
    await admin
      .from("thefts")
      .update({ status: "locked", resolved_at: new Date().toISOString() })
      .in("id", expired);
  }

  // Robbed, but every claim came too late.
  if (claimable.length === 0) {
    return { ok: true, kind: "late" };
  }

  // Caught! The victim always gets back 2× of every claimed theft, and each
  // thief loses 2× of what they stole. The thief is debited as much of the 2×
  // as their balance allows (the all-or-nothing spend can't go negative, so a
  // broke thief is simply drained to 0); the victim is still paid the full 2×.
  let reward = 0;
  for (const t of claimable) {
    const penalty = t.amount * CAUGHT_MULTIPLIER;
    // Read the thief's *real* balance with the service role, then take the most
    // of the 2× they can cover so the spend succeeds instead of failing.
    const thiefBalance = await walletBalance(admin, t.thiefId);
    const take = Math.min(penalty, thiefBalance);
    if (take > 0) {
      await spendBibcoins(t.thiefId, take, "theft_caught", `caught:${t.id}`);
    }
    reward += penalty;
  }

  await admin
    .from("thefts")
    .update({ status: "claimed", resolved_at: new Date().toISOString() })
    .in(
      "id",
      claimable.map((t) => t.id),
    );

  if (reward > 0) {
    await awardBibcoins(
      victimId,
      reward,
      "theft_reward",
      `reward:${victimId}:${crypto.randomUUID()}`,
    );
  }

  return {
    ok: true,
    kind: "reward",
    amount: reward,
    balance: await getBibcoins(victimId),
  };
}
