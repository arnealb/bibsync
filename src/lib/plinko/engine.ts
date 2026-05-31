import {
  PLINKO_MULTIPLIERS,
  type PlinkoRisk,
  type PlinkoRows,
} from "@/lib/plinko/config";

/** Pure, server-authoritative Plinko math. No persistence here. */

export type PlinkoDir = "L" | "R";

export interface PlinkoResult {
  rows: PlinkoRows;
  risk: PlinkoRisk;
  /** Bounce direction at each row (length === rows). */
  path: PlinkoDir[];
  /** Landing slot index 0..rows (= number of rightward bounces). */
  slot: number;
  multiplier: number;
  bet: number;
  payout: number;
}

/** Slot payout curve for a board. */
export function plinkoMultipliers(
  rows: PlinkoRows,
  risk: PlinkoRisk,
): number[] {
  return PLINKO_MULTIPLIERS[rows][risk];
}

/**
 * Drop a ball: at each of `rows` rows it bounces left/right with p = 0.5. Pure
 * given the RNG (`() => number` in [0, 1)). The landing slot is the count of
 * rightward bounces, so the slot distribution is binomial — centred, as on a
 * real Galton board.
 */
export function dropBall(
  rows: PlinkoRows,
  rng: () => number,
): { path: PlinkoDir[]; slot: number } {
  const path = Array.from({ length: rows }, () =>
    rng() < 0.5 ? "L" : "R",
  ) as PlinkoDir[];
  const slot = path.filter((dir) => dir === "R").length;
  return { path, slot };
}

/** Whole-bibcoin payout for landing in `slot`. */
export function plinkoPayout(
  bet: number,
  rows: PlinkoRows,
  risk: PlinkoRisk,
  slot: number,
): number {
  return Math.floor(bet * plinkoMultipliers(rows, risk)[slot]);
}
