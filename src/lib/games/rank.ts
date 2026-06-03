/**
 * Ranking helpers for game runs where ties on score are broken by time
 * (USA Staten records the seconds to the last correct answer; games without
 * a time concept leave it null).
 */
export interface ScoreRun {
  score: number;
  /** Seconds to the run's last point; null when the game records no time. */
  durationSeconds: number | null;
}

/**
 * Whether run `a` beats run `b`: higher score wins; on equal scores the
 * faster (lower) time wins, and a timed run beats an untimed one.
 */
export function isBetterRun(a: ScoreRun, b: ScoreRun): boolean {
  if (a.score !== b.score) return a.score > b.score;
  if (a.durationSeconds === null) return false;
  if (b.durationSeconds === null) return true;
  return a.durationSeconds < b.durationSeconds;
}

/** Sort comparator: best run first (score desc, time asc, untimed last). */
export function compareRuns(a: ScoreRun, b: ScoreRun): number {
  if (isBetterRun(a, b)) return -1;
  if (isBetterRun(b, a)) return 1;
  return 0;
}

/** Formats a duration in seconds as "m:ss". */
export function mmss(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
