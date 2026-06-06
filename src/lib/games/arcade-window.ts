/** Per-event skill games that share the hourly cap (also each one's ledger reason). */
export const ARCADE_REASONS = [
  "snake",
  "flappy",
  "tetris",
  "2048",
  // "minesweeper" is the pre-split (single-key) reason; keeping it counted
  // means old payouts in the current hour still draw from the cap.
  "minesweeper",
  "minesweeper_easy",
  "minesweeper_medium",
  "minesweeper_hard",
] as const;

/**
 * All ledger reasons that draw from the shared ARCADE_HOURLY_CAP. Merge Valley
 * order payouts share the same hourly pool so they can't be farmed past the cap
 * alongside the arcade games.
 */
export const CAPPED_EARN_REASONS = [...ARCADE_REASONS, "merge_order"] as const;

const HOUR_MS = 3_600_000;

/**
 * Start of the current clock hour, in epoch ms. Epoch hour boundaries are UTC,
 * and Brussels is a whole-hour offset, so this is also the start of the current
 * Brussels clock hour.
 */
export function hourStartMs(nowMs: number): number {
  return nowMs - (nowMs % HOUR_MS);
}

/** Milliseconds until the next clock-hour boundary (the cap reset). */
export function msUntilHourReset(nowMs: number): number {
  return HOUR_MS - (nowMs % HOUR_MS);
}
