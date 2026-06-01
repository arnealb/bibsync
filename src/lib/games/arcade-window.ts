/** Per-event skill games that share the hourly cap (also each one's ledger reason). */
export const ARCADE_REASONS = ["snake", "flappy", "tetris", "2048"] as const;

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
