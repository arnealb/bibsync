import { z } from "zod";

export const ROULETTE_BET_TYPES = [
  "straight",
  "red",
  "black",
  "even",
  "odd",
  "low",
  "high",
  "dozen1",
  "dozen2",
  "dozen3",
  "col1",
  "col2",
  "col3",
] as const;

export const rouletteBetSchema = z.object({
  type: z.enum(ROULETTE_BET_TYPES),
  value: z.number().int().min(0).max(36).optional(),
  amount: z.number().int().min(1).max(1_000_000),
});

export const spinRouletteSchema = z.object({
  bets: z.array(rouletteBetSchema).min(1).max(60),
});

export type SpinRouletteInput = z.infer<typeof spinRouletteSchema>;
