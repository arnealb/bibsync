import { z } from "zod";

import { CRASH_MAX_BET, CRASH_MAX_BP } from "@/lib/crash/config";

/** Launch a rocket. */
export const startCrashSchema = z.object({
  roomId: z.string().uuid(),
  bet: z.number().int().min(1).max(CRASH_MAX_BET),
});
export type StartCrashInput = z.infer<typeof startCrashSchema>;

/** Cash out the running round at the multiplier the client is showing. */
export const cashoutCrashSchema = z.object({
  roomId: z.string().uuid(),
  claimedBp: z.number().int().min(100).max(CRASH_MAX_BP),
});
export type CashoutCrashInput = z.infer<typeof cashoutCrashSchema>;
