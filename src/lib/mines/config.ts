/** Single-player Mines tuning. */

/** Tiles on the board (5 × 5). */
export const MINES_GRID_SIZE = 25;

/** Allowed number of bombs. */
export const MINES_MIN = 1;
export const MINES_MAX = 24;

/** House edge shaved off the fair multiplier (1%). */
export const MINES_HOUSE_EDGE = 0.01;

/** Bet ceiling (anti-abuse / overflow guard). */
export const MINES_MAX_BET = 1_000_000;

/** Bomb-count presets offered in the UI. */
export const MINE_COUNT_OPTIONS = [1, 3, 5, 10, 24] as const;

/** Quick-bet chip denominations. */
export const MINES_CHIPS = [10, 50, 100, 500] as const;
