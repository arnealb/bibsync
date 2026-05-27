import { z } from "zod";

export const MIN_BLACKJACK_BET = 10;
export const MAX_BLACKJACK_BET = 1_000_000;

/** Place (or replace) your bet for the current round at a shared table. */
export const placeBlackjackBetSchema = z.object({
  roomId: z.string().uuid(),
  amount: z.number().int().min(MIN_BLACKJACK_BET).max(MAX_BLACKJACK_BET),
});
export type PlaceBlackjackBetInput = z.infer<typeof placeBlackjackBetSchema>;

export const BLACKJACK_ACTIONS = ["hit", "stand", "double", "split"] as const;

/** A turn action (hit/stand/double/split) at a shared table. */
export const playBlackjackSchema = z.object({
  roomId: z.string().uuid(),
  action: z.enum(BLACKJACK_ACTIONS),
});
export type PlayBlackjackInput = z.infer<typeof playBlackjackSchema>;
