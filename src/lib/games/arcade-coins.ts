import { ARCADE_COINS_PER_EVENT } from "@/lib/bibcoins/config";
import type { GameKey } from "@/lib/validation/games";

/**
 * Coins for one finished skill run: the per-game rate × coin-events. Events are
 * the score (apples / pipes / lines) for snake/flappy/tetris; for 2048 the score
 * is the highest tile (a power of two) and events = log2(tile) − 1 (256 → 7).
 * Per-game rates (config) are tuned so faster/easier points pay less.
 */
export function arcadeCoins(gameKey: GameKey, score: number): number {
  if (score <= 0) return 0;
  const events =
    gameKey === "2048" ? Math.max(0, Math.round(Math.log2(score)) - 1) : score;
  const rate =
    ARCADE_COINS_PER_EVENT[gameKey as keyof typeof ARCADE_COINS_PER_EVENT] ?? 0;
  return events * rate;
}

/** Clamp a desired payout to the remaining hourly headroom (never negative). */
export function cappedCoins(
  desired: number,
  earnedThisHour: number,
  cap: number,
): number {
  return Math.max(0, Math.min(desired, cap - earnedThisHour));
}
