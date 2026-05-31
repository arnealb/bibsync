import { z } from "zod";

/** Slot keys you can bet an eating place on (the meal moments). */
export const FOOD_BET_SLOT_KEYS = ["middageten", "avondeten"] as const;

/** Minimum bibcoins per stake. */
export const FOOD_BET_MIN = 10;
export const FOOD_BET_MAX = 1_000_000;

export const stakeFoodPlaceSchema = z.object({
  roomId: z.string().uuid(),
  slotDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  slotKey: z.enum(FOOD_BET_SLOT_KEYS),
  place: z.string().trim().min(1).max(80),
  amount: z.number().int().min(FOOD_BET_MIN).max(FOOD_BET_MAX),
});
export type StakeFoodPlaceInput = z.infer<typeof stakeFoodPlaceSchema>;
