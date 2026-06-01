"use server";

import { awardBibcoins, spendBibcoins } from "@/lib/bibcoins/award";
import { getBibcoins } from "@/lib/bibcoins/queries";
import { copy } from "@/lib/copy";
import {
  spinWheel,
  wheelPayout,
  wheelSegments,
  type WheelResult,
} from "@/lib/wheel/engine";
import { requireRoomAccess } from "@/lib/rooms/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { spinWheelSchema, type SpinWheelInput } from "@/lib/validation/wheel";

export type WheelActionResult =
  | { ok: true; result: WheelResult; balance: number }
  | { ok: false; error: string };

function cryptoRng(): number {
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return buf[0] / 2 ** 32;
}

/** Stake the bet, spin the wheel and pay out instantly. */
export async function spinWheelBet(
  input: SpinWheelInput,
): Promise<WheelActionResult> {
  const parsed = spinWheelSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: copy.common.genericError };
  const { roomId, bet, risk } = parsed.data;

  const access = await requireRoomAccess(roomId);
  if (!access) return { ok: false, error: copy.common.notAuthenticated };
  if (!createAdminClient()) {
    return { ok: false, error: copy.wheel.unavailable };
  }

  if ((await getBibcoins(access.userId)) < bet) {
    return { ok: false, error: copy.wheel.cantAfford };
  }

  const ref = `${roomId}:${access.userId}:${crypto.randomUUID()}`;
  const paid = await spendBibcoins(access.userId, bet, "wheel_bet", ref);
  if (!paid) return { ok: false, error: copy.wheel.cantAfford };

  const index = spinWheel(risk, cryptoRng);
  const multiplier = wheelSegments(risk)[index];
  const payout = wheelPayout(bet, risk, index);

  if (payout > 0) {
    await awardBibcoins(access.userId, payout, "wheel_payout", ref);
  }

  const result: WheelResult = { risk, index, multiplier, bet, payout };
  return { ok: true, result, balance: await getBibcoins(access.userId) };
}
