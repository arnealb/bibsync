import { z } from "zod";

export const MIN_BLACKJACK_BET = 10;

export const dealBlackjackSchema = z.object({
  bet: z.number().int().min(MIN_BLACKJACK_BET).max(1_000_000),
});

export type DealBlackjackInput = z.infer<typeof dealBlackjackSchema>;
