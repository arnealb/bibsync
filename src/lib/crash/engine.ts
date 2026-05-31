import {
  CRASH_HOUSE_EDGE,
  CRASH_MAX_TARGET_BP,
} from "@/lib/crash/config";

/** Pure, server-authoritative Crash math. No persistence here. */

export interface CrashResult {
  /** Cash-out target in basis points (e.g. 200 = 2.00x). */
  targetBp: number;
  /** Where the rocket actually crashed, in basis points (≥ 100). */
  crashBp: number;
  win: boolean;
  bet: number;
  payout: number;
}

/**
 * Roll a crash point in basis points. The tail follows P(C ≥ x) =
 * (1 − houseEdge) / x, the standard crash curve: ~1% instant busts at 1.00x and
 * the expected return of any cash-out target is (1 − houseEdge).
 */
export function crashPointBp(rng: () => number): number {
  const r = (1 - CRASH_HOUSE_EDGE) / (1 - rng());
  if (r < 1) return 100; // instant bust at 1.00x
  return Math.min(CRASH_MAX_TARGET_BP, Math.floor(r * 100));
}

/** Did a cash-out at `targetBp` survive a crash at `crashBp`? */
export function crashWin(targetBp: number, crashBp: number): boolean {
  return crashBp >= targetBp;
}

/** Win probability (0..1) of holding out for `targetBp`. */
export function crashWinChance(targetBp: number): number {
  return ((1 - CRASH_HOUSE_EDGE) * 100) / targetBp;
}

/** Whole-bibcoin payout on a win (floored — fractional winnings to the house). */
export function crashPayout(bet: number, targetBp: number): number {
  return Math.floor((bet * targetBp) / 100);
}
