"use server";

import { awardBibcoins, spendBibcoins } from "@/lib/bibcoins/award";
import { getBibcoins } from "@/lib/bibcoins/queries";
import { unlockAchievement } from "@/lib/bibcoins/unlock";
import { pickNumber, totalPayout, type Bet } from "@/lib/roulette/engine";
import { copy } from "@/lib/copy";
import { getAuthContext } from "@/lib/auth";
import { spinRouletteSchema } from "@/lib/validation/roulette";

export type SpinResult =
  | { ok: true; number: number; payout: number; balance: number }
  | { ok: false; error: string };

function cryptoRng(): number {
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return buf[0] / 2 ** 32;
}

/** Place bets and spin once: deducts the stake, rolls server-side, pays out. */
export async function spinRoulette(bets: Bet[]): Promise<SpinResult> {
  const parsed = spinRouletteSchema.safeParse({ bets });
  if (!parsed.success) return { ok: false, error: copy.common.genericError };

  // Straight bets must name a number.
  for (const bet of parsed.data.bets) {
    if (bet.type === "straight" && bet.value === undefined) {
      return { ok: false, error: copy.common.genericError };
    }
  }

  const ctx = await getAuthContext();
  if (!ctx) return { ok: false, error: copy.common.notAuthenticated };

  const total = parsed.data.bets.reduce((sum, b) => sum + b.amount, 0);
  const balance = await getBibcoins(ctx.user.id);
  if (total > balance) return { ok: false, error: copy.roulette.cantAfford };

  const spinId = crypto.randomUUID();
  const paid = await spendBibcoins(ctx.user.id, total, "roulette_bet", spinId);
  if (!paid) return { ok: false, error: copy.roulette.cantAfford };

  const number = pickNumber(cryptoRng);
  const payout = totalPayout(parsed.data.bets as Bet[], number);
  if (payout > 0) {
    await awardBibcoins(ctx.user.id, payout, "roulette_payout", spinId);
    await unlockAchievement(ctx.user.id, "roulette_win");
  }

  return {
    ok: true,
    number,
    payout,
    balance: await getBibcoins(ctx.user.id),
  };
}
