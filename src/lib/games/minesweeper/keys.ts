import type { MinesweeperDifficulty } from "@/lib/games/minesweeper/engine";
import type { GameKey } from "@/lib/validation/games";

/**
 * Leaderboard game key per difficulty. Minesweeper ranks on completion time:
 * every win submits the (constant per difficulty) safe-cell count as score
 * plus the elapsed seconds, so the score-desc/time-asc ranking reduces to
 * "fastest win first" within a difficulty.
 */
export const MINESWEEPER_GAME_KEYS: Record<MinesweeperDifficulty, GameKey> = {
  easy: "minesweeper_easy",
  medium: "minesweeper_medium",
  hard: "minesweeper_hard",
};
