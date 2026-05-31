/** Per-room lottery tuning. */

/** Coins per ticket. */
export const LOTTERY_TICKET_PRICE = 100;

/** Tickets you can buy in one go (anti fat-finger). */
export const LOTTERY_MAX_TICKETS_PER_BUY = 50;

/** Distinct players needed before the draw countdown starts / a draw is valid. */
export const LOTTERY_MIN_PLAYERS = 2;

/** Countdown once enough players have joined (ms). */
export const LOTTERY_DRAW_WINDOW_MS = 120_000;

/** How long the winner is shown before the next round opens (ms). */
export const LOTTERY_RESULT_MS = 8_000;

/** Fraction of the pot kept by the house (0 = winner takes all). */
export const LOTTERY_RAKE = 0;

/** Quick-buy ticket counts. */
export const LOTTERY_QUICK_BUYS = [1, 5, 10] as const;
