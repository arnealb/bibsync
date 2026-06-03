/** Mexen (Mexico) — local pass-and-play dice game tuning. */

/** Players are picked from the room's members. */
export const MEXEN_MIN_PLAYERS = 2;
export const MEXEN_MAX_PLAYERS = 10;

/** A turn is 1–3 throws; the round's first player fixes the count for everyone. */
export const MEXEN_MIN_THROWS = 1;
export const MEXEN_MAX_THROWS = 3;

/** A game runs a fixed number of rounds. */
export const MEXEN_MIN_ROUNDS = 1;
export const MEXEN_MAX_ROUNDS = 20;
export const MEXEN_DEFAULT_ROUNDS = 5;

/** Per-round bibcoin stake (when betting is enabled): loser pays the winner. */
export const MEXEN_DEFAULT_STAKE = 10;
export const MEXEN_MAX_STAKE = 1_000_000;

/** Quick-stake chips. */
export const MEXEN_STAKE_CHIPS = [5, 10, 25, 50] as const;

/** Rank floors keep the three tiers strictly ordered (mexen > doubles > normals). */
export const MEXEN_RANK_MEXEN = 1000;
export const MEXEN_RANK_DOUBLE_BASE = 100; // 11→101 … 66→106
