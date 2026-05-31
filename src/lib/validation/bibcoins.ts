import { z } from "zod";

/** Max coins moved in a single transfer (anti-fat-finger / abuse guard). */
export const TRANSFER_MAX = 1_000_000;

export const transferBibcoinsSchema = z.object({
  recipientId: z.string().uuid(),
  amount: z.number().int().min(1).max(TRANSFER_MAX),
});
export type TransferBibcoinsInput = z.infer<typeof transferBibcoinsSchema>;
