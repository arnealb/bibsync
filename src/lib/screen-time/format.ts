/** Screen-time display helpers. Pure — safe in client components. */

/** Whole minutes from a second count (floored). */
export function toMinutes(seconds: number): number {
  return Math.floor(Math.max(seconds, 0) / 60);
}

/**
 * Dutch, compact duration from seconds: "2 u 5 min", "45 min", "0 min".
 * Hours only shown once there is at least one full hour.
 */
export function formatScreenTime(seconds: number): string {
  const totalMinutes = toMinutes(seconds);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours} u ${minutes} min`;
  return `${minutes} min`;
}
