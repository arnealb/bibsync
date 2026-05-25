import { z } from "zod";

import {
  MAX_INSTANT_BREAK_DURATION,
  MIN_INSTANT_BREAK_DURATION,
} from "@/lib/instant-break/config";

export const pushInstantBreakSchema = z.object({
  roomId: z.string().uuid(),
  durationMinutes: z
    .number()
    .int()
    .min(MIN_INSTANT_BREAK_DURATION)
    .max(MAX_INSTANT_BREAK_DURATION),
});

export type PushInstantBreakInput = z.infer<typeof pushInstantBreakSchema>;
