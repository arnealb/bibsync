"use server";

import { getAuthContext } from "@/lib/auth";
import { awardBibcoins, spendBibcoins } from "@/lib/bibcoins/award";
import { getBibcoins } from "@/lib/bibcoins/queries";
import { copy } from "@/lib/copy";
import { requireRoomAccess } from "@/lib/rooms/queries";
import {
  CAUGHT_MULTIPLIER,
  FALSE_CLAIM_PENALTY,
  STEAL_COOLDOWN_MS,
  THEFT_REASON_PREFIX,
} from "@/lib/theft/config";
import type { ClaimResult, StealResult } from "@/lib/theft/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { stealSchema, type StealInput } from "@/lib/validation/theft";

/** Steal coins from another member. The coins move immediately. */
export async function stealCoins(input: StealInput): Promise<StealResult> {
  const parsed = stealSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: copy.common.genericError };
  const { roomId, victimId, amount } = parsed.data;

  const access = await requireRoomAccess(roomId);
  if (!access) return { ok: false, error: copy.common.notAuthenticated };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: copy.theft.unavailable };
  const thiefId = access.userId;

  if (victimId === thiefId) {
    return { ok: false, error: copy.theft.notYourself };
  }

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

  // One open theft per (thief, victim) pair.
  const { data: open } = await admin
    .from("thefts")
    .select("id")
    .eq("thief_id", thiefId)
    .eq("victim_id", victimId)
    .eq("status", "pending")
    .limit(1);
  if (open && open.length > 0) {
    return { ok: false, error: copy.theft.alreadyOpen };
  }

  const victimBalance = await getBibcoins(victimId);
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
    room_id: roomId,
    thief_id: thiefId,
    victim_id: victimId,
    amount,
  });
  if (error) {
    console.error("[stealCoins]", error);
    // Roll the coins back so a failed record doesn't strand the theft.
    await spendBibcoins(thiefId, amount, "theft_gain_refund", ref);
    await awardBibcoins(victimId, amount, "theft_loss_refund", ref);
    return { ok: false, error: copy.common.genericError };
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

  const { data: pending } = await admin
    .from("thefts")
    .select("id, thief_id, amount, created_at")
    .eq("victim_id", victimId)
    .eq("status", "pending");

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

  // Caught! Reclaim 2× from each thief (bounded by their balance) and pay it
  // to the victim. No minting — the victim only gets what the thieves can pay.
  let recovered = 0;
  for (const t of claimable) {
    const thiefBalance = await getBibcoins(t.thiefId);
    const want = t.amount * CAUGHT_MULTIPLIER;
    const reclaim = Math.min(want, thiefBalance);
    const ref = `caught:${t.id}`;
    if (reclaim > 0) {
      const took = await spendBibcoins(t.thiefId, reclaim, "theft_caught", ref);
      if (took) recovered += reclaim;
    }
  }

  await admin
    .from("thefts")
    .update({ status: "claimed", resolved_at: new Date().toISOString() })
    .in(
      "id",
      claimable.map((t) => t.id),
    );

  if (recovered > 0) {
    await awardBibcoins(
      victimId,
      recovered,
      "theft_reward",
      `reward:${victimId}:${crypto.randomUUID()}`,
    );
  }

  return {
    ok: true,
    kind: "reward",
    amount: recovered,
    balance: await getBibcoins(victimId),
  };
}
