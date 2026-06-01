/** "Stelen" mechanic tuning. */

/** A false "I was robbed" claim costs this much → goes to the casino fund. */
export const FALSE_CLAIM_PENALTY = 250;

/** A caught thief pays back this multiple of what they stole to the victim. */
export const CAUGHT_MULTIPLIER = 2;

/** Minimum time between a thief's steals (any victim), anti-spam. */
export const STEAL_COOLDOWN_MS = 5 * 60 * 1000;

/** Ledger reasons that are part of the theft mechanic (never a "real" spend). */
export const THEFT_REASON_PREFIX = "theft_";
