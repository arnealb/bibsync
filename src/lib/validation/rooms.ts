import { z } from "zod";

import { copy } from "@/lib/copy";
import {
  CUSTOM_CODE_MAX,
  CUSTOM_CODE_MIN,
  CUSTOM_CODE_PATTERN,
} from "@/lib/rooms/join-code";

/** A self-chosen join code: letters + digits, normalised to upper-case. */
const customJoinCode = z
  .string()
  .trim()
  .toUpperCase()
  .min(CUSTOM_CODE_MIN, copy.rooms.validation.codeLength)
  .max(CUSTOM_CODE_MAX, copy.rooms.validation.codeLength)
  .regex(CUSTOM_CODE_PATTERN, copy.rooms.validation.codeChars);

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
  joinCode: customJoinCode.optional(),
});

export const renameRoomSchema = z.object({
  roomId: z.string().uuid(),
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

export const setJoinCodeSchema = z.object({
  roomId: z.string().uuid(),
  joinCode: customJoinCode,
});

export const joinRoomSchema = z.object({
  joinCode: z
    .string()
    .trim()
    .toUpperCase()
    .min(CUSTOM_CODE_MIN, copy.rooms.validation.joinCodeLength)
    .max(CUSTOM_CODE_MAX, copy.rooms.validation.joinCodeLength),
});

export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type SetJoinCodeInput = z.infer<typeof setJoinCodeSchema>;
export type JoinRoomInput = z.infer<typeof joinRoomSchema>;
