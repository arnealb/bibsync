export type CosmeticType =
  | "frame"
  | "color"
  | "badge"
  | "accessory"
  | "pet"
  | "title"
  | "effect";

export interface CosmeticItem {
  id: string;
  type: CosmeticType;
  name: string;
  price: number;
  /**
   * frame  → ring colour (hex) or "rainbow"
   * color  → name text colour (hex)
   * badge/accessory/pet → an emoji
   * title  → the flair text shown next to your name
   * effect → an animated name-effect key (see lib/cosmetics/effects)
   */
  value: string;
}

/** The loadout column that stores each cosmetic type's equipped item. */
export const TYPE_COLUMN: Record<CosmeticType, string> = {
  frame: "frame",
  color: "name_color",
  badge: "badge",
  accessory: "accessory",
  pet: "pet",
  title: "title",
  effect: "effect",
};

/** Cosmetic catalogue — extend freely; ids are stable keys. */
export const COSMETICS: CosmeticItem[] = [
  // Frames (coloured ring around the avatar)
  { id: "frame_emerald", type: "frame", name: "Smaragd-rand", price: 120, value: "#10b981" },
  { id: "frame_sky", type: "frame", name: "Hemelsblauwe rand", price: 120, value: "#38bdf8" },
  { id: "frame_pink", type: "frame", name: "Roze rand", price: 120, value: "#ec4899" },
  { id: "frame_gold", type: "frame", name: "Gouden rand", price: 180, value: "#f59e0b" },
  { id: "frame_rainbow", type: "frame", name: "Regenboog-rand", price: 350, value: "rainbow" },

  // Name colours
  { id: "color_emerald", type: "color", name: "Smaragd-naam", price: 80, value: "#10b981" },
  { id: "color_sky", type: "color", name: "Hemelsblauwe naam", price: 80, value: "#38bdf8" },
  { id: "color_pink", type: "color", name: "Roze naam", price: 80, value: "#ec4899" },
  { id: "color_gold", type: "color", name: "Gouden naam", price: 120, value: "#f59e0b" },

  // Badges (corner emoji)
  { id: "badge_fire", type: "badge", name: "Vuur", price: 60, value: "🔥" },
  { id: "badge_star", type: "badge", name: "Ster", price: 60, value: "⭐" },
  { id: "badge_skull", type: "badge", name: "Schedel", price: 60, value: "💀" },
  { id: "badge_crown", type: "badge", name: "Kroon", price: 150, value: "👑" },

  // Accessories (overlaid on top of the avatar)
  { id: "acc_glasses", type: "accessory", name: "Zonnebril", price: 100, value: "🕶️" },
  { id: "acc_tophat", type: "accessory", name: "Hoge hoed", price: 120, value: "🎩" },
  { id: "acc_party", type: "accessory", name: "Feesthoedje", price: 100, value: "🎉" },

  // Pets (shown beside the avatar)
  { id: "pet_cat", type: "pet", name: "Kat", price: 200, value: "🐱" },
  { id: "pet_dog", type: "pet", name: "Hond", price: 200, value: "🐶" },
  { id: "pet_dragon", type: "pet", name: "Draak", price: 400, value: "🐉" },

  // ── Premium (2k+) ──────────────────────────────────────────────────────
  // Titles: a flair shown next to your name in "Wie is er?". Pure flex.
  { id: "title_goat", type: "title", name: "GOAT", price: 2000, value: "🐐 GOAT" },
  { id: "title_brein", type: "title", name: "Brein", price: 2000, value: "🧠 Brein" },
  { id: "title_rijkaard", type: "title", name: "Rijkaard", price: 2500, value: "🤑 Rijkaard" },
  { id: "title_sigma", type: "title", name: "Sigma", price: 3000, value: "💀 Sigma" },
  { id: "title_prof", type: "title", name: "Professor", price: 4000, value: "🎓 Professor" },
  { id: "title_legende", type: "title", name: "Legende", price: 6000, value: "👑 Legende" },

  // Name effects: animated styling on your displayed name.
  { id: "fx_glow", type: "effect", name: "Paarse glow", price: 2500, value: "glow" },
  { id: "fx_gold", type: "effect", name: "Gouden glans", price: 3000, value: "gold" },
  { id: "fx_rainbow", type: "effect", name: "Regenboog-naam", price: 4000, value: "rainbow" },
  { id: "fx_fire", type: "effect", name: "Vurige naam", price: 5000, value: "fire" },
];

export const COSMETIC_BY_ID = new Map(COSMETICS.map((c) => [c.id, c]));

export const COSMETIC_TYPES: CosmeticType[] = [
  "title",
  "effect",
  "frame",
  "color",
  "badge",
  "accessory",
  "pet",
];

export function cosmeticsByType(type: CosmeticType): CosmeticItem[] {
  return COSMETICS.filter((c) => c.type === type);
}
