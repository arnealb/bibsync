"use server";

import { awardBibcoins, spendBibcoins } from "@/lib/bibcoins/award";
import { getBibcoins } from "@/lib/bibcoins/queries";
import { copy } from "@/lib/copy";
import {
  dropBall,
  plinkoMultipliers,
  plinkoPayout,
  type PlinkoResult,
} from "@/lib/plinko/engine";
import { requireRoomAccess } from "@/lib/rooms/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { dropPlinkoSchema, type DropPlinkoInput } from "@/lib/validation/plinko";

export type PlinkoActionResult =
  | { ok: true; result: PlinkoResult; balance: number }
  | { ok: false; error: string };

/** Uniform [0,1) from the CSPRNG — drives the ball's bounces server-side. */
function cryptoRng(): number {
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return buf[0] / 2 ** 32;
}

/**
 * Stake the bet, drop a ball and pay out instantly. Server-authoritative: the
 * path is rolled here and only reported back; the client merely animates it.
 */
export async function dropPlinko(
  input: DropPlinkoInput,
): Promise<PlinkoActionResult> {
  const parsed = dropPlinkoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: copy.common.genericError };
  const { roomId, bet, rows, risk } = parsed.data;

  const access = await requireRoomAccess(roomId);
  if (!access) return { ok: false, error: copy.common.notAuthenticated };
  if (access.isPilloried) return { ok: false, error: copy.pillory.frozen };
  if (!createAdminClient()) {
    return { ok: false, error: copy.plinko.unavailable };
  }

  const balance = await getBibcoins(access.userId);
  if (bet > balance) return { ok: false, error: copy.plinko.cantAfford };

  const ref = `${roomId}:${access.userId}:${crypto.randomUUID()}`;
  const paid = await spendBibcoins(access.userId, bet, "plinko_bet", ref);
  if (!paid) return { ok: false, error: copy.plinko.cantAfford };

  const { path, slot } = dropBall(rows, cryptoRng);
  const multiplier = plinkoMultipliers(rows, risk)[slot];
  const payout = plinkoPayout(bet, rows, risk, slot);

  if (payout > 0) {
    await awardBibcoins(access.userId, payout, "plinko_payout", ref);
  }

  const result: PlinkoResult = {
    rows,
    risk,
    path,
    slot,
    multiplier,
    bet,
    payout,
  };
  return { ok: true, result, balance: await getBibcoins(access.userId) };
}
