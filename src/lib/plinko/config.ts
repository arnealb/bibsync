/** Single-player Plinko tuning. */

export const PLINKO_ROWS_OPTIONS = [8, 12, 16] as const;
export type PlinkoRows = (typeof PLINKO_ROWS_OPTIONS)[number];

export const PLINKO_RISKS = ["low", "medium", "high"] as const;
export type PlinkoRisk = (typeof PLINKO_RISKS)[number];

/** Bet ceiling (anti-abuse / overflow guard). */
export const PLINKO_MAX_BET = 1_000_000;

/** Quick-bet chip denominations. */
export const PLINKO_CHIPS = [10, 50, 100, 500] as const;

/** How many balls one "drop" launches; they fall staggered, not all at once. */
export const PLINKO_BALL_COUNTS = [1, 5, 10, 25] as const;
export const PLINKO_MAX_BALLS = 50;

/**
 * Slot multipliers per (rows, risk). Each table is symmetric and has
 * `rows + 1` entries — one per landing slot, lowest in the middle, hottest at
 * the edges. These are the widely-published Stake-style payout curves.
 */
export const PLINKO_MULTIPLIERS: Record<
  PlinkoRows,
  Record<PlinkoRisk, number[]>
> = {
  8: {
    low: [5.6, 2.1, 1.1, 1, 0.5, 1, 1.1, 2.1, 5.6],
    medium: [13, 3, 1.3, 0.7, 0.4, 0.7, 1.3, 3, 13],
    high: [29, 4, 1.5, 0.3, 0.2, 0.3, 1.5, 4, 29],
  },
  12: {
    low: [10, 3, 1.6, 1.4, 1.1, 1, 0.5, 1, 1.1, 1.4, 1.6, 3, 10],
    medium: [24, 5, 3, 1.3, 0.7, 0.4, 0.2, 0.4, 0.7, 1.3, 3, 5, 24],
    high: [58, 8, 3, 2, 0.7, 0.2, 0.2, 0.2, 0.7, 2, 3, 8, 58],
  },
  16: {
    low: [16, 9, 2, 1.4, 1.4, 1.2, 1.1, 1, 0.5, 1, 1.1, 1.2, 1.4, 1.4, 2, 9, 16],
    medium: [
      110, 41, 10, 5, 3, 1.5, 1, 0.5, 0.3, 0.5, 1, 1.5, 3, 5, 10, 41, 110,
    ],
    high: [
      1000, 130, 26, 9, 4, 2, 0.2, 0.2, 0.2, 0.2, 0.2, 2, 4, 9, 26, 130, 1000,
    ],
  },
};

/** Tailwind background class for a slot, hotter the higher the multiplier. */
export function plinkoMultiplierColor(multiplier: number): string {
  if (multiplier >= 10) return "bg-red-500";
  if (multiplier >= 3) return "bg-orange-500";
  if (multiplier >= 1.5) return "bg-amber-500";
  if (multiplier >= 1) return "bg-yellow-400";
  return "bg-yellow-300";
}
