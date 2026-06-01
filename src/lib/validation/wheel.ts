import { z } from "zod";

import { WHEEL_MAX_BET, WHEEL_MIN_BET, WHEEL_RISKS } from "@/lib/wheel/config";

/** Spin the wheel once. */
export const spinWheelSchema = z.object({
  roomId: z.string().uuid(),
  bet: z.number().int().min(WHEEL_MIN_BET).max(WHEEL_MAX_BET),
  risk: z.enum(WHEEL_RISKS),
});
export type SpinWheelInput = z.infer<typeof spinWheelSchema>;
