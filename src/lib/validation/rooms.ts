import { z } from "zod";

import { copy } from "@/lib/copy";
import { JOIN_CODE_LENGTH } from "@/lib/rooms/join-code";

export const createRoomSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, copy.rooms.validation.nameRequired)
    .max(60, copy.rooms.validation.nameTooLong),
  description: z
    .string()
    .trim()
    .max(280, copy.rooms.validation.descriptionTooLong)
    .optional(),
});

export const renameRoomSchema = createRoomSchema.extend({
  roomId: z.string().uuid(),
});

export const joinRoomSchema = z.object({
  joinCode: z
    .string()
    .trim()
    .toUpperCase()
    .length(JOIN_CODE_LENGTH, copy.rooms.validation.joinCodeLength),
});

export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type JoinRoomInput = z.infer<typeof joinRoomSchema>;
