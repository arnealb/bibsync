import { z } from "zod";

export const startVoetbalSchema = z.object({
  roomId: z.string().uuid(),
  categoryKey: z.string().min(1).max(32),
});

export const guessVoetbalSchema = z.object({
  roomId: z.string().uuid(),
  roundId: z.string().uuid(),
  categoryKey: z.string().min(1).max(32),
  guess: z.string().min(1).max(60),
});

export type StartVoetbalInput = z.infer<typeof startVoetbalSchema>;
export type GuessVoetbalInput = z.infer<typeof guessVoetbalSchema>;
