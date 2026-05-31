/** Single-player Crash tuning (live cash-out, provably fair). */

export const CRASH_HOUSE_EDGE = 0.01;

/** Multiplier ceiling in basis points (1000.00x). */
export const CRASH_MAX_BP = 100_000;

/** How fast the multiplier grows: ×factor per second (~doubles every ~2s). */
export const CRASH_GROWTH_PER_SEC = 1.4;

/** Bet bounds. */
export const CRASH_MAX_BET = 1_000_000;

/** Quick-bet chip denominations. */
export const CRASH_CHIPS = [10, 50, 100, 500] as const;
