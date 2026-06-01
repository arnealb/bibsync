"use server";

import { awardBibcoins, spendBibcoins } from "@/lib/bibcoins/award";
import { getBibcoins } from "@/lib/bibcoins/queries";
import { copy } from "@/lib/copy";
import {
  drawKeno,
  kenoHits,
  kenoMultiplier,
  kenoPayout,
  type KenoResult,
} from "@/lib/keno/engine";
import { requireRoomAccess } from "@/lib/rooms/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { playKenoSchema, type PlayKenoInput } from "@/lib/validation/keno";

export type KenoActionResult =
  | { ok: true; result: KenoResult; balance: number }
  | { ok: false; error: string };

function cryptoRng(): number {
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return buf[0] / 2 ** 32;
}

/** Stake the bet, draw 10 numbers and pay out by hits. Instant + stateless. */
export async function playKeno(
  input: PlayKenoInput,
): Promise<KenoActionResult> {
  const parsed = playKenoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: copy.common.genericError };
  const { roomId, bet, picks } = parsed.data;

  const access = await requireRoomAccess(roomId);
  if (!access) return { ok: false, error: copy.common.notAuthenticated };
  if (!createAdminClient()) return { ok: false, error: copy.keno.unavailable };

  if ((await getBibcoins(access.userId)) < bet) {
    return { ok: false, error: copy.keno.cantAfford };
  }

  const ref = `${roomId}:${access.userId}:${crypto.randomUUID()}`;
  const paid = await spendBibcoins(access.userId, bet, "keno_bet", ref);
  if (!paid) return { ok: false, error: copy.keno.cantAfford };

  const drawn = drawKeno(cryptoRng);
  const hits = kenoHits(picks, drawn);
  const multiplier = kenoMultiplier(picks.length, hits.length);
  const payout = kenoPayout(bet, picks.length, hits.length);

  if (payout > 0) {
    await awardBibcoins(access.userId, payout, "keno_payout", ref);
  }

  const result: KenoResult = {
    picks,
    drawn,
    hits,
    multiplier,
    bet,
    payout,
  };
  return { ok: true, result, balance: await getBibcoins(access.userId) };
}
