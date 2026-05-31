/** Single-player Crash tuning (auto-cashout / "Limbo"-style, provably fair). */

export const CRASH_HOUSE_EDGE = 0.01;

/** Cash-out target range in basis points: 1.01x – 1000.00x. */
export const CRASH_MIN_TARGET_BP = 101;
export const CRASH_MAX_TARGET_BP = 100_000;
export const CRASH_DEFAULT_TARGET_BP = 200; // 2.00x

/** Bet bounds. */
export const CRASH_MAX_BET = 1_000_000;

/** Quick-bet chip denominations. */
export const CRASH_CHIPS = [10, 50, 100, 500] as const;

/** Quick cash-out targets (basis points). */
export const CRASH_TARGET_PRESETS = [150, 200, 300, 1000] as const;
