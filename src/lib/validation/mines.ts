import { z } from "zod";

import {
  MINES_GRID_SIZE,
  MINES_MAX,
  MINES_MAX_BET,
  MINES_MIN,
} from "@/lib/mines/config";

/** Start a fresh single-player game. */
export const startMinesSchema = z.object({
  roomId: z.string().uuid(),
  bet: z.number().int().min(1).max(MINES_MAX_BET),
  mineCount: z.number().int().min(MINES_MIN).max(MINES_MAX),
});
export type StartMinesInput = z.infer<typeof startMinesSchema>;

/** Open one tile. */
export const revealMinesSchema = z.object({
  roomId: z.string().uuid(),
  tile: z.number().int().min(0).max(MINES_GRID_SIZE - 1),
});
export type RevealMinesInput = z.infer<typeof revealMinesSchema>;

/** Cash out the current game. */
export const cashoutMinesSchema = z.object({
  roomId: z.string().uuid(),
});
export type CashoutMinesInput = z.infer<typeof cashoutMinesSchema>;
