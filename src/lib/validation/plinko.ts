import { z } from "zod";

import { PLINKO_MAX_BET, PLINKO_MIN_BET, PLINKO_RISKS } from "@/lib/plinko/config";

/** Drop one ball. */
export const dropPlinkoSchema = z.object({
  roomId: z.string().uuid(),
  bet: z.number().int().min(PLINKO_MIN_BET).max(PLINKO_MAX_BET),
  rows: z.union([z.literal(8), z.literal(12), z.literal(16)]),
  risk: z.enum(PLINKO_RISKS),
});
export type DropPlinkoInput = z.infer<typeof dropPlinkoSchema>;
