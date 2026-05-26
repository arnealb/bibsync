/** Bibcoins economy tuning. */

export const BIBCOINS_START = 2000;

/** Reward amounts per earning event. */
export const REWARD = {
  /** First (and only) vote on a given proposal/food item. */
  vote: 5,
  /** Sending 20 chat messages in a day (once/day). */
  dailyChat: 25,
  /** Per +1 of a new honest Snake personal best. */
  snakeBestPerPoint: 1,
} as const;

/** Messages needed in one day for the daily-chat reward. */
export const DAILY_CHAT_THRESHOLD = 20;
