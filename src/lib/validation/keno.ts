import { z } from "zod";

import {
  KENO_MAX_BET,
  KENO_MAX_PICKS,
  KENO_MIN_BET,
  KENO_POOL,
} from "@/lib/keno/config";

/** Play Keno: bet + the chosen numbers (1..40, 1..10 distinct). */
export const playKenoSchema = z.object({
  roomId: z.string().uuid(),
  bet: z.number().int().min(KENO_MIN_BET).max(KENO_MAX_BET),
  picks: z
    .array(z.number().int().min(1).max(KENO_POOL))
    .min(1)
    .max(KENO_MAX_PICKS)
    .refine((arr) => new Set(arr).size === arr.length, {
      message: "Dubbele getallen.",
    }),
});
export type PlayKenoInput = z.infer<typeof playKenoSchema>;
