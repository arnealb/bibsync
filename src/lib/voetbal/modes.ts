/** Client-safe list of game modes for the Voetbal hub (labels live in copy.ts). */
export type VoetbalMode = "namen" | "hogerlager" | "quiz" | "mystery";

export interface VoetbalModeMeta {
  key: VoetbalMode;
  emoji: string;
}

export const VOETBAL_MODES: VoetbalModeMeta[] = [
  { key: "namen", emoji: "📝" },
  { key: "hogerlager", emoji: "📈" },
  { key: "quiz", emoji: "❓" },
  { key: "mystery", emoji: "🕵️" },
];
