/** Daily quests + login-streak tuning. */

export type QuestMetric =
  | "votes"
  | "messages"
  | "game_wins"
  | "proposals"
  | "comments";

export interface QuestDef {
  key: string;
  emoji: string;
  title: string;
  goal: number;
  reward: number;
  metric: QuestMetric;
}

/** Fixed daily quests (reset every Brussels day). */
export const DAILY_QUESTS: readonly QuestDef[] = [
  { key: "vote3", emoji: "🗳️", title: "Stem op 3 voorstellen", goal: 3, reward: 150, metric: "votes" },
  { key: "chat10", emoji: "💬", title: "Stuur 10 chatberichten", goal: 10, reward: 100, metric: "messages" },
  { key: "gamewin", emoji: "🎰", title: "Win een casinospel", goal: 1, reward: 200, metric: "game_wins" },
  { key: "propose", emoji: "☕", title: "Doe een pauzevoorstel", goal: 1, reward: 100, metric: "proposals" },
];

/** Daily-bonus reward for a given streak length: 50 → 500 (×50, capped at 10). */
export function streakReward(streak: number): number {
  return Math.min(Math.max(streak, 1), 10) * 50;
}
