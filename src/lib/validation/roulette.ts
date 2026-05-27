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

export const rouletteBetSchema = z
  .object({
    type: z.enum(ROULETTE_BET_TYPES),
    value: z.number().int().min(0).max(36).optional(),
    amount: z.number().int().min(1).max(1_000_000),
  })
  .refine((b) => b.type !== "straight" || b.value !== undefined, {
    message: "Een nummer-inzet heeft een nummer nodig.",
  });

/** Place a single chip-stack on one spot at the shared table. */
export const placeRouletteBetSchema = z.object({
  roomId: z.string().uuid(),
  bet: rouletteBetSchema,
});

export type PlaceRouletteBetInput = z.infer<typeof placeRouletteBetSchema>;
