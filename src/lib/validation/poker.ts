import { z } from "zod";

export const POKER_ACTIONS = [
  "fold",
  "check",
  "call",
  "raise",
  "allin",
] as const;

export const playerActionSchema = z.object({
  roomId: z.string().uuid(),
  action: z.enum(POKER_ACTIONS),
  amount: z.number().int().min(0).max(1_000_000).optional(),
});

export type PlayerActionInput = z.infer<typeof playerActionSchema>;
