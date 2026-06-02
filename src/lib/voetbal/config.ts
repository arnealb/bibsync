/** "Voetbal" naming-game tuning. */

/** Seconds per round. */
export const VOETBAL_ROUND_SECONDS = 120;

/** Bibcoins per correct, unique player named (clamped to the hourly cap). */
export const VOETBAL_COINS_PER_CORRECT = 25;

/** Generous own hourly cap so the game is worth grinding (its own ledger pool). */
export const VOETBAL_HOURLY_CAP = 750;

/** Fraction of the list you must name to "win" the round. */
export const VOETBAL_WIN_FRACTION = 0.5;

/** Ledger reason for screen-time-style idempotent payouts. */
export const VOETBAL_REASON = "voetbal";
