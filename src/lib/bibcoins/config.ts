/** Bibcoins economy tuning. */

export const BIBCOINS_START = 2000;

/** Once-a-day login bonus (mirrors `claim_daily_bibcoins` in SQL — display only). */
export const DAILY_BONUS = 100;

/** Passive trickle per hour (mirrors `claim_hourly_bibcoins` in SQL — display only). */
export const HOURLY_TRICKLE = 15;

/** Reward amounts per earning event. */
export const REWARD = {
  /** First (and only) vote on a given proposal. */
  vote: 5,
  /**
   * Proposing a break — paid once per (room, day), NOT per proposal, so you
   * can't farm coins by spamming proposals. Free proposals and slot
   * preferences share this daily key.
   */
  createProposal: 200,
  /** Commenting on a proposal — paid once per (room, day), not per comment. */
  comment: 100,
  /** Sending 20 chat messages in a day (once/day). */
  dailyChat: 25,
  /** Per +1 of a new honest Snake personal best. */
  snakeBestPerPoint: 1,
  /** Per +1 of a new Flappy Bird personal best. */
  flappyBestPerPoint: 10,
  /** Clearing a Pet Connect board (once per day). */
  petConnectDaily: 30,
  /** Per full 1000 steps of a user's daily total (capped, see below). */
  stepsPer1000: 10,
} as const;

/** Messages needed in one day for the daily-chat reward. */
export const DAILY_CHAT_THRESHOLD = 20;

/** Max thousands of daily steps that earn bibcoins (anti-abuse cap). */
export const STEPS_REWARD_DAILY_CAP_THOUSANDS = 20;
