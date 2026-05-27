/** Maps a name-effect cosmetic value to its CSS class (defined in globals.css). */
const EFFECT_CLASS: Record<string, string> = {
  glow: "fx-glow",
  gold: "fx-gold",
  rainbow: "fx-rainbow",
  fire: "fx-fire",
};

export function effectClassName(value: string | null | undefined): string {
  return value ? (EFFECT_CLASS[value] ?? "") : "";
}
