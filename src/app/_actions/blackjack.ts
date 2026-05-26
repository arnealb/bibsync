"use server";

import type { SupabaseClient } from "@supabase/supabase-js";

import { awardBibcoins, spendBibcoins } from "@/lib/bibcoins/award";
import { getBibcoins } from "@/lib/bibcoins/queries";
import { unlockAchievement } from "@/lib/bibcoins/unlock";
import {
  canSplit,
  deal as engineDeal,
  doubleDown,
  hit,
  split,
  stand,
  toPublicBlackjack,
  totalPayout,
  type BlackjackState,
  type PublicBlackjack,
} from "@/lib/blackjack/engine";
import { copy } from "@/lib/copy";
import { makeDeck, shuffle } from "@/lib/poker/cards";
import { getAuthContext } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { dealBlackjackSchema } from "@/lib/validation/blackjack";

export type BlackjackResultPayload =
  | { ok: true; state: PublicBlackjack; balance: number }
  | { ok: false; error: string };

function cryptoRng(): () => number {
  return () => {
    const buf = new Uint32Array(1);
    globalThis.crypto.getRandomValues(buf);
    return buf[0] / 2 ** 32;
  };
}

interface Loaded {
  state: BlackjackState;
  version: number;
}

async function load(
  admin: SupabaseClient,
  userId: string,
): Promise<Loaded | null> {
  const { data } = await admin
    .from("blackjack_games")
    .select("state, version")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return null;
  const state = data.state as unknown as BlackjackState;
  // Ignore states from an older shape so a fresh round starts cleanly.
  if (!Array.isArray(state.hands)) return null;
  return { state, version: data.version };
}

/** Optimistic-locked update of an in-progress round. */
async function persist(
  admin: SupabaseClient,
  userId: string,
  oldVersion: number,
  state: BlackjackState,
): Promise<boolean> {
  const updated = await admin
    .from("blackjack_games")
    .update({
      state,
      version: oldVersion + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("version", oldVersion)
    .select("user_id");
  return Boolean(updated.data && updated.data.length > 0);
}

/** Pays out a resolved round (once) and unlocks the win achievement. */
async function settleRewards(userId: string, state: BlackjackState): Promise<void> {
  if (state.status !== "done") return;
  const payout = totalPayout(state);
  if (payout > 0) {
    await awardBibcoins(userId, payout, "blackjack_payout", state.roundId);
  }
  if (state.hands.some((h) => h.result === "win" || h.result === "blackjack")) {
    await unlockAchievement(userId, "blackjack_win");
  }
}

async function authed(): Promise<
  | { ok: true; userId: string; admin: SupabaseClient }
  | { ok: false; error: string }
> {
  const ctx = await getAuthContext();
  if (!ctx) return { ok: false, error: copy.common.notAuthenticated };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: copy.blackjack.unavailable };
  return { ok: true, userId: ctx.user.id, admin };
}

/** Start a new round with the given bet. */
export async function dealBlackjack(
  bet: number,
): Promise<BlackjackResultPayload> {
  const parsed = dealBlackjackSchema.safeParse({ bet });
  if (!parsed.success) return { ok: false, error: copy.common.genericError };

  const auth = await authed();
  if (!auth.ok) return auth;

  const loaded = await load(auth.admin, auth.userId);
  if (loaded && loaded.state.status !== "done") {
    return { ok: false, error: copy.blackjack.roundInProgress };
  }

  const balance = await getBibcoins(auth.userId);
  if (parsed.data.bet > balance) {
    return { ok: false, error: copy.blackjack.cantAfford };
  }

  const roundId = crypto.randomUUID();
  const paid = await spendBibcoins(
    auth.userId,
    parsed.data.bet,
    "blackjack_bet",
    roundId,
  );
  if (!paid) return { ok: false, error: copy.blackjack.cantAfford };

  const state = engineDeal(
    roundId,
    shuffle(makeDeck(), cryptoRng()),
    parsed.data.bet,
  );

  await auth.admin.from("blackjack_games").upsert(
    {
      user_id: auth.userId,
      state,
      version: (loaded?.version ?? 0) + 1,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  await settleRewards(auth.userId, state);

  return {
    ok: true,
    state: toPublicBlackjack(state),
    balance: await getBibcoins(auth.userId),
  };
}

async function applyMove(
  mutate: (state: BlackjackState) => BlackjackState,
): Promise<BlackjackResultPayload> {
  const auth = await authed();
  if (!auth.ok) return auth;

  const loaded = await load(auth.admin, auth.userId);
  if (!loaded || loaded.state.status !== "player") {
    return { ok: false, error: copy.blackjack.noRound };
  }

  let next: BlackjackState;
  try {
    next = mutate(loaded.state);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : copy.common.genericError,
    };
  }

  const ok = await persist(auth.admin, auth.userId, loaded.version, next);
  if (!ok) return { ok: false, error: copy.blackjack.busy };

  await settleRewards(auth.userId, next);
  return {
    ok: true,
    state: toPublicBlackjack(next),
    balance: await getBibcoins(auth.userId),
  };
}

export async function hitBlackjack(): Promise<BlackjackResultPayload> {
  return applyMove((state) => hit(state));
}

export async function standBlackjack(): Promise<BlackjackResultPayload> {
  return applyMove((state) => stand(state));
}

/** Double the bet: charge an extra stake, then draw one and resolve. */
export async function doubleBlackjack(): Promise<BlackjackResultPayload> {
  const auth = await authed();
  if (!auth.ok) return auth;

  const loaded = await load(auth.admin, auth.userId);
  const hand = loaded?.state.hands[loaded.state.active];
  if (
    !loaded ||
    loaded.state.status !== "player" ||
    !hand ||
    hand.cards.length !== 2 ||
    hand.doubled
  ) {
    return { ok: false, error: copy.blackjack.noRound };
  }

  const extra = hand.bet;
  const ref = `${loaded.state.roundId}:double:${loaded.state.active}`;
  const paid = await spendBibcoins(auth.userId, extra, "blackjack_bet", ref);
  if (!paid) return { ok: false, error: copy.blackjack.cantAfford };

  let next: BlackjackState;
  try {
    next = doubleDown(loaded.state);
  } catch (error) {
    await awardBibcoins(auth.userId, extra, "blackjack_refund", ref);
    return {
      ok: false,
      error: error instanceof Error ? error.message : copy.common.genericError,
    };
  }

  const ok = await persist(auth.admin, auth.userId, loaded.version, next);
  if (!ok) return { ok: false, error: copy.blackjack.busy };

  await settleRewards(auth.userId, next);
  return {
    ok: true,
    state: toPublicBlackjack(next),
    balance: await getBibcoins(auth.userId),
  };
}

/** Split a pair into two hands (charges an extra base bet). */
export async function splitBlackjack(): Promise<BlackjackResultPayload> {
  const auth = await authed();
  if (!auth.ok) return auth;

  const loaded = await load(auth.admin, auth.userId);
  if (!loaded || !canSplit(loaded.state)) {
    return { ok: false, error: copy.blackjack.noRound };
  }

  const extra = loaded.state.baseBet;
  const ref = `${loaded.state.roundId}:split`;
  const paid = await spendBibcoins(auth.userId, extra, "blackjack_bet", ref);
  if (!paid) return { ok: false, error: copy.blackjack.cantAfford };

  let next: BlackjackState;
  try {
    next = split(loaded.state);
  } catch (error) {
    await awardBibcoins(auth.userId, extra, "blackjack_refund", ref);
    return {
      ok: false,
      error: error instanceof Error ? error.message : copy.common.genericError,
    };
  }

  const ok = await persist(auth.admin, auth.userId, loaded.version, next);
  if (!ok) return { ok: false, error: copy.blackjack.busy };

  await settleRewards(auth.userId, next);
  return {
    ok: true,
    state: toPublicBlackjack(next),
    balance: await getBibcoins(auth.userId),
  };
}
