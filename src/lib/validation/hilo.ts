import { z } from "zod";

/** Bet bounds for Hi-Lo. */
export const HILO_MIN_BET = 1;
export const HILO_MAX_BET = 1_000_000;

export const startHiloSchema = z.object({
  roomId: z.string().uuid(),
  bet: z.number().int().min(HILO_MIN_BET).max(HILO_MAX_BET),
});
export type StartHiloInput = z.infer<typeof startHiloSchema>;

export const guessHiloSchema = z.object({
  roomId: z.string().uuid(),
  direction: z.enum(["higher", "lower"]),
});
export type GuessHiloInput = z.infer<typeof guessHiloSchema>;
