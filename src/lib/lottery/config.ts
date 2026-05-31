/** Per-room lottery tuning. The draw runs daily at a fixed Brussels hour. */

/** Coins per ticket. */
export const LOTTERY_TICKET_PRICE = 100;

/** Tickets you can buy in one go (anti fat-finger). */
export const LOTTERY_MAX_TICKETS_PER_BUY = 50;

/** Hour of day (Brussels) the draw runs — see migration 0045 (pg_cron). */
export const LOTTERY_DRAW_HOUR = 22;

/** Quick-buy ticket counts. */
export const LOTTERY_QUICK_BUYS = [1, 5, 10] as const;
