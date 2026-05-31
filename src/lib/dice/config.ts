/** Single-player Dice tuning (Stake-style over/under). */

export const DICE_HOUSE_EDGE = 0.01;

/** Rolls are integers 0..9999, i.e. 0.00–99.99 at 2-decimal precision. */
export const DICE_OUTCOMES = 10_000;

/** Target range in basis points: 2.00–98.00 (keeps multipliers ~1.01x–49.5x). */
export const DICE_MIN_BP = 200;
export const DICE_MAX_BP = 9800;
export const DICE_DEFAULT_BP = 5000; // 50.00

/** Bet ceiling (anti-abuse / overflow guard). */
export const DICE_MAX_BET = 1_000_000;

/** Quick-bet chip denominations. */
export const DICE_CHIPS = [10, 50, 100, 500] as const;

export const DICE_DIRECTIONS = ["over", "under"] as const;
export type DiceDirection = (typeof DICE_DIRECTIONS)[number];
