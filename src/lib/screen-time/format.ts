/** Screen-time display helpers. Pure — safe in client components. */

import {
  SCREEN_TIME_COINS_PER_MINUTE,
  SCREEN_TIME_REWARD_DAILY_CAP_MINUTES,
} from "@/lib/bibcoins/config";

/** Whole minutes from a second count (floored). */
export function toMinutes(seconds: number): number {
  return Math.floor(Math.max(seconds, 0) / 60);
}

/**
 * Bibcoins earned for a day's screen time — mirrors `record_screen_time`:
 * full minutes (capped at the daily cap) × coins-per-minute. Display only.
 */
export function screenTimeCoins(seconds: number): number {
  const minutes = Math.min(toMinutes(seconds), SCREEN_TIME_REWARD_DAILY_CAP_MINUTES);
  return minutes * SCREEN_TIME_COINS_PER_MINUTE;
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
