import { z } from "zod";

/** Steal a positive whole amount from another member in a room. */
export const stealSchema = z.object({
  roomId: z.string().uuid(),
  victimId: z.string().uuid(),
  amount: z.number().int().min(1),
});

export type StealInput = z.infer<typeof stealSchema>;
