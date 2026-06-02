"use server";

import { getAuthContext } from "@/lib/auth";
import { awardBibcoins } from "@/lib/bibcoins/award";
import { getBibcoins } from "@/lib/bibcoins/queries";
import { copy } from "@/lib/copy";
import { cappedCoins } from "@/lib/games/arcade-coins";
import { hourStartMs } from "@/lib/games/arcade-window";
import { requireRoomAccess } from "@/lib/rooms/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { categoryMeta } from "@/lib/voetbal/categories";
import {
  VOETBAL_COINS_PER_CORRECT,
  VOETBAL_HOURLY_CAP,
  VOETBAL_REASON,
  VOETBAL_WIN_FRACTION,
} from "@/lib/voetbal/config";
import { categoryData } from "@/lib/voetbal/data";
import { initials, matchGuess } from "@/lib/voetbal/match";
import {
  guessVoetbalSchema,
  startVoetbalSchema,
  type GuessVoetbalInput,
  type StartVoetbalInput,
} from "@/lib/validation/voetbal";

/** A masked card the client renders — never carries the player's name. */
export interface VoetbalSlot {
  /** Canonical index into the category list — stable id to reveal on a match. */
  id: number;
  flag: string;
  position: string;
  initials: string;
}

export type StartRoundResult =
  | {
      ok: true;
      roundId: string;
      categoryKey: string;
      label: string;
      emoji: string;
      total: number;
      winAt: number;
      slots: VoetbalSlot[];
      balance: number;
      hourEarned: number;
    }
  | { ok: false; error: string };

export type GuessResult =
  | {
      ok: true;
      correct: boolean;
      /** Canonical slot id when correct, so the client reveals that card. */
      id?: number;
      name?: string;
      coins: number;
      balance: number;
      hourEarned: number;
    }
  | { ok: false; error: string };

/** Coins this user earned from voetbal in the current clock hour. */
async function voetbalEarnedThisHour(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  userId: string,
): Promise<number> {
  const sinceIso = new Date(hourStartMs(Date.now())).toISOString();
  const { data } = await admin
    .from("bibcoin_transactions")
    .select("amount")
    .eq("user_id", userId)
    .eq("reason", VOETBAL_REASON)
    .gte("created_at", sinceIso);
  return (data ?? []).reduce(
    (sum: number, row: { amount: number }) => sum + row.amount,
    0,
  );
}

/** Coins earned this hour for the cap bar (own pool). */
export async function getVoetbalHourEarned(): Promise<number> {
  const ctx = await getAuthContext();
  if (!ctx) return 0;
  const admin = createAdminClient();
  if (!admin) return 0;
  return voetbalEarnedThisHour(admin, ctx.user.id);
}

/** Shuffle a copy with the CSPRNG (cosmetic — only the card order). */
function shuffled<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const buf = new Uint32Array(1);
    globalThis.crypto.getRandomValues(buf);
    const j = buf[0] % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Start a round: pick the category and hand back masked, shuffled cards. */
export async function startVoetbalRound(
  input: StartVoetbalInput,
): Promise<StartRoundResult> {
  const parsed = startVoetbalSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: copy.common.genericError };

  const access = await requireRoomAccess(parsed.data.roomId);
  if (!access) return { ok: false, error: copy.common.notAuthenticated };

  const meta = categoryMeta(parsed.data.categoryKey);
  const data = categoryData(parsed.data.categoryKey);
  if (!meta || !data) return { ok: false, error: copy.common.genericError };

  const admin = createAdminClient();
  if (!admin) return { ok: false, error: copy.voetbal.unavailable };

  const slots: VoetbalSlot[] = shuffled(
    data.players.map((p, id) => ({
      id,
      flag: p.flag,
      position: p.position,
      initials: initials(p.name),
    })),
  );

  return {
    ok: true,
    roundId: crypto.randomUUID(),
    categoryKey: data.key,
    label: meta.label,
    emoji: meta.emoji,
    total: data.players.length,
    winAt: Math.ceil(data.players.length * VOETBAL_WIN_FRACTION),
    slots,
    balance: await getBibcoins(access.userId),
    hourEarned: await voetbalEarnedThisHour(admin, access.userId),
  };
}

export type RevealResult =
  | { ok: true; names: { id: number; name: string }[] }
  | { ok: false };

/** Reveal every player's name — for the end-of-round summary only. */
export async function revealVoetbal(categoryKey: string): Promise<RevealResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { ok: false };
  const data = categoryData(categoryKey);
  if (!data) return { ok: false };
  return {
    ok: true,
    names: data.players.map((p, id) => ({ id, name: p.name })),
  };
}

/**
 * Validate a guess server-side and pay for a newly named player. Idempotent per
 * (round, player) via the ledger ref, so re-guessing a found player pays
 * nothing; the per-hour cap bounds the total. The client is never trusted with
 * answers — it only learns which card (id) a correct guess revealed.
 */
export async function guessVoetbal(
  input: GuessVoetbalInput,
): Promise<GuessResult> {
  const parsed = guessVoetbalSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: copy.common.genericError };
  const { roomId, roundId, categoryKey, guess } = parsed.data;

  const access = await requireRoomAccess(roomId);
  if (!access) return { ok: false, error: copy.common.notAuthenticated };

  const data = categoryData(categoryKey);
  if (!data) return { ok: false, error: copy.common.genericError };

  const admin = createAdminClient();
  if (!admin) return { ok: false, error: copy.voetbal.unavailable };

  const id = matchGuess(data.players, guess);
  if (id < 0) {
    return {
      ok: true,
      correct: false,
      coins: 0,
      balance: await getBibcoins(access.userId),
      hourEarned: await voetbalEarnedThisHour(admin, access.userId),
    };
  }

  const earned = await voetbalEarnedThisHour(admin, access.userId);
  const coins = cappedCoins(
    VOETBAL_COINS_PER_CORRECT,
    earned,
    VOETBAL_HOURLY_CAP,
  );
  let granted = 0;
  if (coins > 0) {
    const ok = await awardBibcoins(
      access.userId,
      coins,
      VOETBAL_REASON,
      `voetbal:${roundId}:${id}`,
    );
    if (ok) granted = coins;
  }

  return {
    ok: true,
    correct: true,
    id,
    name: data.players[id].name,
    coins: granted,
    balance: await getBibcoins(access.userId),
    hourEarned: earned + granted,
  };
}
