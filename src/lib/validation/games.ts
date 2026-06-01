import { z } from "zod";

export const GAME_KEYS = [
  "snake",
  "petconnect",
  "flappy",
  "tetris",
  "2048",
] as const;
export const gameKeySchema = z.enum(GAME_KEYS);
export type GameKey = z.infer<typeof gameKeySchema>;

export const submitScoreSchema = z.object({
  roomId: z.string().uuid(),
  gameKey: gameKeySchema,
  score: z.number().int().min(0).max(100_000),
  cheated: z.boolean().optional(),
});

export type SubmitScoreInput = z.infer<typeof submitScoreSchema>;
