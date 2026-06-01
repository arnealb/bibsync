import { z } from "zod";

/** Steal a positive whole amount from another user (global). */
export const stealSchema = z.object({
  victimId: z.string().uuid(),
  amount: z.number().int().min(1),
});

export type StealInput = z.infer<typeof stealSchema>;
