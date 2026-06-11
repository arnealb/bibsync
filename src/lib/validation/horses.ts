import { z } from "zod";

import {
  HORSE_COUNT,
  HORSES_MAX_BET,
  HORSES_MIN_BET,
} from "@/lib/horses/config";

/** Stake a bet on one horse in an open race. */
export const placeHorseBetSchema = z.object({
  roomId: z.string().uuid(),
  raceId: z.number().int().positive(),
  horseIdx: z
    .number()
    .int()
    .min(0)
    .max(HORSE_COUNT - 1),
  amount: z.number().int().min(HORSES_MIN_BET).max(HORSES_MAX_BET),
});
export type PlaceHorseBetInput = z.infer<typeof placeHorseBetSchema>;
