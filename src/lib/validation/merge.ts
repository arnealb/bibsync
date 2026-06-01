import { z } from "zod";

import { BOARD_CELLS } from "@/lib/merge/config";

const roomId = z.string().uuid();
const cell = z.number().int().min(0).max(BOARD_CELLS - 1);

/** Load (or create) the caller's board. */
export const mergeRoomSchema = z.object({ roomId });

/** Tap the generator to spawn an item. */
export const mergeTapSchema = z.object({ roomId });

/** Move one cell onto another (empty → move, identical → merge). */
export const mergeMoveSchema = z.object({ roomId, from: cell, to: cell });

/** Deliver an order. */
export const mergeOrderSchema = z.object({ roomId, orderId: z.string().min(1).max(40) });

/** Buy an energy refill with bibcoins. */
export const mergeBuyEnergySchema = z.object({ roomId });

export type MergeRoomInput = z.infer<typeof mergeRoomSchema>;
export type MergeMoveInput = z.infer<typeof mergeMoveSchema>;
export type MergeOrderInput = z.infer<typeof mergeOrderSchema>;
