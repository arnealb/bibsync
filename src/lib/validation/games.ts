import { z } from "zod";

import { US_STATE_CODE_TUPLE } from "@/lib/usstates/states";

export const GAME_KEYS = [
  "snake",
  "petconnect",
  "flappy",
  "tetris",
  "2048",
  "usstates",
  // Minesweeper ranks on completion time, tracked per difficulty.
  "minesweeper_easy",
  "minesweeper_medium",
  "minesweeper_hard",
] as const;
export const gameKeySchema = z.enum(GAME_KEYS);
export type GameKey = z.infer<typeof gameKeySchema>;

export const submitScoreSchema = z.object({
  roomId: z.string().uuid(),
  gameKey: gameKeySchema,
  score: z.number().int().min(0).max(100_000),
  cheated: z.boolean().optional(),
  /** Seconds to the run's last point — score ties rank the fastest first. */
  durationSeconds: z.number().int().min(0).max(86_400).optional(),
  /**
   * Pay the arcade coins but record no leaderboard row — used by a lost
   * Minesweeper game, where revealed cells earn coins but only a completed
   * board has a rankable time.
   */
  coinsOnly: z.boolean().optional(),
});

export type SubmitScoreInput = z.infer<typeof submitScoreSchema>;

export const claimStateCoinSchema = z.object({
  roomId: z.string().uuid(),
  code: z.enum(US_STATE_CODE_TUPLE),
});

export type ClaimStateCoinInput = z.infer<typeof claimStateCoinSchema>;
