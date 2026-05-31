import { z } from "zod";

import { LOTTERY_MAX_TICKETS_PER_BUY } from "@/lib/lottery/config";

/** Buy `count` lottery tickets in a room. */
export const buyTicketsSchema = z.object({
  roomId: z.string().uuid(),
  count: z.number().int().min(1).max(LOTTERY_MAX_TICKETS_PER_BUY),
});
export type BuyTicketsInput = z.infer<typeof buyTicketsSchema>;
