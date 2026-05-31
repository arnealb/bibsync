"use server";

import { awardBibcoins, spendBibcoins } from "@/lib/bibcoins/award";
import { getBibcoins } from "@/lib/bibcoins/queries";
import { copy } from "@/lib/copy";
import {
  diceMultiplier,
  dicePayout,
  diceWin,
  rollDice,
  type DiceResult,
} from "@/lib/dice/engine";
import { requireRoomAccess } from "@/lib/rooms/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { rollDiceSchema, type RollDiceInput } from "@/lib/validation/dice";

export type DiceActionResult =
  | { ok: true; result: DiceResult; balance: number }
  | { ok: false; error: string };

/** Uniform [0,1) from the CSPRNG — rolls the dice server-side. */
function cryptoRng(): number {
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return buf[0] / 2 ** 32;
}

/** Stake the bet, roll, and pay out instantly. Server-authoritative. */
export async function placeDiceBet(
  input: RollDiceInput,
): Promise<DiceActionResult> {
  const parsed = rollDiceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: copy.common.genericError };
  const { roomId, bet, targetBp, direction } = parsed.data;

  const access = await requireRoomAccess(roomId);
  if (!access) return { ok: false, error: copy.common.notAuthenticated };
  if (!createAdminClient()) {
    return { ok: false, error: copy.dice.unavailable };
  }

  const balance = await getBibcoins(access.userId);
  if (bet > balance) return { ok: false, error: copy.dice.cantAfford };

  const ref = `${roomId}:${access.userId}:${crypto.randomUUID()}`;
  const paid = await spendBibcoins(access.userId, bet, "dice_bet", ref);
  if (!paid) return { ok: false, error: copy.dice.cantAfford };

  const roll = rollDice(cryptoRng);
  const win = diceWin(roll, targetBp, direction);
  const multiplier = diceMultiplier(targetBp, direction);
  const payout = win ? dicePayout(bet, targetBp, direction) : 0;

  if (payout > 0) {
    await awardBibcoins(access.userId, payout, "dice_payout", ref);
  }

  const result: DiceResult = {
    targetBp,
    direction,
    roll,
    win,
    multiplier,
    bet,
    payout,
  };
  return { ok: true, result, balance: await getBibcoins(access.userId) };
}
