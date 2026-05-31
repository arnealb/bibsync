import { z } from "zod";

import {
  CRASH_MAX_BET,
  CRASH_MAX_TARGET_BP,
  CRASH_MIN_TARGET_BP,
} from "@/lib/crash/config";

/** Launch one rocket with a pre-set cash-out target. */
export const crashBetSchema = z.object({
  roomId: z.string().uuid(),
  bet: z.number().int().min(1).max(CRASH_MAX_BET),
  targetBp: z.number().int().min(CRASH_MIN_TARGET_BP).max(CRASH_MAX_TARGET_BP),
});
export type CrashBetInput = z.infer<typeof crashBetSchema>;
