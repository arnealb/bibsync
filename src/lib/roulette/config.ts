/** Multiplayer roulette tuning. */

/** Length of the betting window once the first bet of a round is placed (ms). */
export const ROULETTE_BETTING_MS = 30_000;

/** Wheel spin duration (ms). Must match the CSS transition on the wheel — the
 *  result stays hidden until this elapses so you can't tell you've won before
 *  the wheel stops. */
export const ROULETTE_SPIN_MS = 4_000;

/** How long the result/animation shows before the next round opens (ms). */
export const ROULETTE_RESULT_MS = 6_000;

/** Cap on bets per round (anti-abuse / payload size). */
export const ROULETTE_MAX_BETS = 200;

/** Chip denominations offered in the UI. */
export const ROULETTE_CHIPS = [10, 50, 100, 500] as const;
