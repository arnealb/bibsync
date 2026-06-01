import { COSMETICS, type CosmeticItem } from "@/lib/cosmetics/catalog";

/**
 * "Mysterieuze kist" (gacha crate) tuning.
 *
 * A crate is a recurring coin **sink**: you pay a fixed price to open it and
 * get one random cosmetic. The pool is deliberately limited to the affordable
 * cosmetics (the premium 2k+ titles/effects stay shop-only) so a cheap crate
 * can never roll a hugely +EV reward — opening crates is always at-best
 * EV-neutral on the first copy and a clear sink once your collection fills, but
 * fun/flex-positive (the real draw). Duplicates refund a slice instead of a
 * full feels-bad nothing.
 */

export type Rarity = "common" | "rare" | "epic";

/** Cost to open one crate. */
export const CRATE_PRICE = 150;

/** A duplicate roll refunds this fraction of the price (rounded down). */
export const DUP_REFUND_FRACTION = 0.4;

/** Relative odds per rarity (need not sum to 100). */
export const RARITY_WEIGHTS: Record<Rarity, number> = {
  common: 55,
  rare: 33,
  epic: 12,
};

/** Display metadata per rarity (label + Tailwind colour classes for the reveal). */
export const RARITY_META: Record<Rarity, { label: string; className: string }> =
  {
    common: { label: "Gewoon", className: "text-slate-500 dark:text-slate-400" },
    rare: { label: "Zeldzaam", className: "text-sky-600 dark:text-sky-400" },
    epic: { label: "Episch", className: "text-fuchsia-600 dark:text-fuchsia-400" },
  };

/** Classify a cosmetic into a crate rarity by price. */
function rarityOf(item: CosmeticItem): Rarity {
  if (item.price <= 100) return "common";
  if (item.price <= 180) return "rare";
  return "epic";
}

/**
 * The crate pool, grouped by rarity. Excludes premium titles/effects (those are
 * a direct, intentional purchase, never a cheap gacha drop).
 */
export const CRATE_POOL: Record<Rarity, CosmeticItem[]> = (() => {
  const pool: Record<Rarity, CosmeticItem[]> = {
    common: [],
    rare: [],
    epic: [],
  };
  for (const item of COSMETICS) {
    if (item.type === "title" || item.type === "effect") continue;
    pool[rarityOf(item)].push(item);
  }
  return pool;
})();

/** Rarities that actually have at least one item (defensive). */
export const ACTIVE_RARITIES: Rarity[] = (
  Object.keys(RARITY_WEIGHTS) as Rarity[]
).filter((r) => CRATE_POOL[r].length > 0);
