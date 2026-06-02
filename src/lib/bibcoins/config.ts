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
  /** Clearing a Pet Connect board (once per day). */
  petConnectDaily: 30,
  /** Per full 1000 steps of a user's daily total (capped, see below). */
  stepsPer1000: 10,
} as const;

/** Messages needed in one day for the daily-chat reward. */
export const DAILY_CHAT_THRESHOLD = 20;

/** Max thousands of daily steps that earn bibcoins (anti-abuse cap). */
export const STEPS_REWARD_DAILY_CAP_THOUSANDS = 20;

/**
 * Screen-time reward: bibcoins per full minute the app is open. Mirrors the
 * `record_screen_time` RPC in SQL (display only — the RPC is authoritative).
 */
export const SCREEN_TIME_COINS_PER_MINUTE = 10;

/** Max minutes of screen time rewarded per day (12h, anti-abuse). */
export const SCREEN_TIME_REWARD_DAILY_CAP_MINUTES = 720;

/** How often the browser sends a screen-time heartbeat while the tab is visible. */
export const SCREEN_TIME_HEARTBEAT_MS = 60 * 1000;

/** Shared cap on per-event skill-game coins (snake/flappy/tetris/2048) per
 * clock hour (anti-abuse). */
export const ARCADE_HOURLY_CAP = 250;

/**
 * Coins per coin-event, tuned per game so faster/easier points pay less:
 * snake/flappy = per apple/pipe, tetris = per line, 2048 = per new tile
 * (a milestone = log2−1). Shared 250/hour cap bounds the total.
 */
export const ARCADE_COINS_PER_EVENT = {
  snake: 3,
  flappy: 3,
  tetris: 8,
  "2048": 12,
} as const;
