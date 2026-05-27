/** Multiplayer roulette tuning. */

/** Length of the betting window once the first bet of a round is placed (ms). */
export const ROULETTE_BETTING_MS = 30_000;

/** How long the result/animation shows before the next round opens (ms). */
export const ROULETTE_RESULT_MS = 6_000;

/** Cap on bets per round (anti-abuse / payload size). */
export const ROULETTE_MAX_BETS = 200;

/** Chip denominations offered in the UI. */
export const ROULETTE_CHIPS = [10, 50, 100, 500] as const;
