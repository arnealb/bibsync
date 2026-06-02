/**
 * Client-safe category metadata (NO answers). The full player lists live in the
 * server-only `data.ts`; keep this file free of any accepted-answer data so it
 * can be imported into client components without leaking the round solutions.
 */
export interface VoetbalCategoryMeta {
  key: string;
  label: string;
  emoji: string;
  /** Number of players in the list (for the progress / win threshold UI). */
  total: number;
}

export const VOETBAL_CATEGORIES: VoetbalCategoryMeta[] = [
  { key: "wereld", label: "Wereldsterren", emoji: "🌍", total: 12 },
  { key: "legendes", label: "Legendes", emoji: "🐐", total: 12 },
  { key: "duivels", label: "Rode Duivels", emoji: "🇧🇪", total: 12 },
  { key: "oranje", label: "Oranje", emoji: "🟠", total: 12 },
];

export function categoryMeta(key: string): VoetbalCategoryMeta | undefined {
  return VOETBAL_CATEGORIES.find((c) => c.key === key);
}
