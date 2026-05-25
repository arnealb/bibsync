import type { PresenceStatus } from "@/types/database";

/** Emoji per presence status (matches the deel-2 spec). */
export const PRESENCE_EMOJI: Record<PresenceStatus, string> = {
  studying: "📚",
  break: "☕",
  lunch: "🍽️",
  away: "🚪",
  done: "🏠",
};
