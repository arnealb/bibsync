import { z } from "zod";

export const MESSAGE_MAX_LENGTH = 2000;
export const MESSAGE_COUNTER_THRESHOLD = 1800;
export const MESSAGE_PAGE_SIZE = 50;

export const sendMessageSchema = z.object({
  roomId: z.string().uuid(),
  content: z.string().trim().min(1).max(MESSAGE_MAX_LENGTH),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export const editMessageSchema = z.object({
  messageId: z.string().uuid(),
  content: z.string().trim().min(1).max(MESSAGE_MAX_LENGTH),
});

export type EditMessageInput = z.infer<typeof editMessageSchema>;
