/** The fixed set of emoji users can react with on a chat message. */
export const REACTION_EMOJIS = ["👍", "❤️", "😂", "🎉", "👎", "🔥"] as const;

export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];
