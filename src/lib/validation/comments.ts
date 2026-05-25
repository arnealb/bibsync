import { z } from "zod";

export const COMMENT_MAX_LENGTH = 500;

export const addCommentSchema = z.object({
  proposalId: z.string().uuid(),
  content: z.string().trim().min(1).max(COMMENT_MAX_LENGTH),
});

export type AddCommentInput = z.infer<typeof addCommentSchema>;
