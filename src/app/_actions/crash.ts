"use server";

import { awardBibcoins, spendBibcoins } from "@/lib/bibcoins/award";
import { getBibcoins } from "@/lib/bibcoins/queries";
import { copy } from "@/lib/copy";
import {
  crashPayout,
  crashPointBp,
  crashWin,
  type CrashResult,
} from "@/lib/crash/engine";
import { requireRoomAccess } from "@/lib/rooms/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { crashBetSchema, type CrashBetInput } from "@/lib/validation/crash";

export type CrashActionResult =
  | { ok: true; result: CrashResult; balance: number }
  | { ok: false; error: string };

/** Uniform [0,1) from the CSPRNG — rolls the crash point server-side. */
function cryptoRng(): number {
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return buf[0] / 2 ** 32;
}

/** Stake the bet, roll the crash point and settle against the target. */
export async function placeCrashBet(
  input: CrashBetInput,
): Promise<CrashActionResult> {
  const parsed = crashBetSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: copy.common.genericError };
  const { roomId, bet, targetBp } = parsed.data;

  const access = await requireRoomAccess(roomId);
  if (!access) return { ok: false, error: copy.common.notAuthenticated };
  if (!createAdminClient()) {
    return { ok: false, error: copy.crash.unavailable };
  }

  const balance = await getBibcoins(access.userId);
  if (bet > balance) return { ok: false, error: copy.crash.cantAfford };

  const ref = `${roomId}:${access.userId}:${crypto.randomUUID()}`;
  const paid = await spendBibcoins(access.userId, bet, "crash_bet", ref);
  if (!paid) return { ok: false, error: copy.crash.cantAfford };

  const crashBp = crashPointBp(cryptoRng);
  const win = crashWin(targetBp, crashBp);
  const payout = win ? crashPayout(bet, targetBp) : 0;

  if (payout > 0) {
    await awardBibcoins(access.userId, payout, "crash_payout", ref);
  }

  const result: CrashResult = { targetBp, crashBp, win, bet, payout };
  return { ok: true, result, balance: await getBibcoins(access.userId) };
}
