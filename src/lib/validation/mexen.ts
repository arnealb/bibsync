import { z } from "zod";

import { MEXEN_MAX_STAKE } from "@/lib/mexen/config";

/** Roll a fresh pair of dice (server-side fairness). */
export const rollMexenSchema = z.object({
  roomId: z.string().uuid(),
});
export type RollMexenInput = z.infer<typeof rollMexenSchema>;

/** Settle one round's bibcoin stake: the loser pays the winner. */
export const settleMexenSchema = z.object({
  roomId: z.string().uuid(),
  loserId: z.string().uuid(),
  winnerId: z.string().uuid(),
  stake: z.number().int().min(1).max(MEXEN_MAX_STAKE),
  /** Client-supplied idempotency key for this round. */
  ref: z.string().min(1).max(200),
});
export type SettleMexenInput = z.infer<typeof settleMexenSchema>;
