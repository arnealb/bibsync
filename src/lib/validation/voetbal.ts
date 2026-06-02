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

const roomId = z.string().uuid();
const roundId = z.string().min(1).max(80);

export const hogerLagerGuessSchema = z.object({
  roomId,
  roundId,
  choice: z.enum(["higher", "lower"]),
});

export const quizAnswerSchema = z.object({
  roomId,
  roundId,
  optionId: z.number().int().min(0).max(10),
});

export const mysteryGuessSchema = z.object({
  roomId,
  roundId,
  guess: z.string().min(1).max(60),
});

export type HogerLagerGuessInput = z.infer<typeof hogerLagerGuessSchema>;
export type QuizAnswerInput = z.infer<typeof quizAnswerSchema>;
export type MysteryGuessInput = z.infer<typeof mysteryGuessSchema>;
