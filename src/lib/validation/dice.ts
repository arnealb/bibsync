import { z } from "zod";

import {
  DICE_DIRECTIONS,
  DICE_MAX_BET,
  DICE_MAX_BP,
  DICE_MIN_BP,
} from "@/lib/dice/config";

/** Roll once against a target. */
export const rollDiceSchema = z.object({
  roomId: z.string().uuid(),
  bet: z.number().int().min(1).max(DICE_MAX_BET),
  targetBp: z.number().int().min(DICE_MIN_BP).max(DICE_MAX_BP),
  direction: z.enum(DICE_DIRECTIONS),
});
export type RollDiceInput = z.infer<typeof rollDiceSchema>;
