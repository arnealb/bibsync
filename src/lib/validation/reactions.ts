import { z } from "zod";

import { REACTION_EMOJIS } from "@/lib/chat/reactions";

export const toggleReactionSchema = z.object({
  messageId: z.string().uuid(),
  emoji: z.enum(REACTION_EMOJIS),
});

export type ToggleReactionInput = z.infer<typeof toggleReactionSchema>;
