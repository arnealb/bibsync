import type { CosmeticItem } from "@/lib/cosmetics/catalog";
import {
  ACTIVE_RARITIES,
  CRATE_POOL,
  RARITY_WEIGHTS,
  type Rarity,
} from "@/lib/crates/config";

/** Pure, server-authoritative crate roll. No persistence, no RNG inside. */

export interface CrateRoll {
  item: CosmeticItem;
  rarity: Rarity;
}

/** Pick a rarity from a roll in [0, 1) using the (active) weight table. */
export function pickRarity(roll: number): Rarity {
  const total = ACTIVE_RARITIES.reduce((s, r) => s + RARITY_WEIGHTS[r], 0);
  let cursor = Math.min(Math.max(roll, 0), 0.999999) * total;
  for (const rarity of ACTIVE_RARITIES) {
    cursor -= RARITY_WEIGHTS[rarity];
    if (cursor < 0) return rarity;
  }
  return ACTIVE_RARITIES[ACTIVE_RARITIES.length - 1]!;
}

/**
 * Roll one crate. `rarityRoll` and `itemRoll` are independent draws in [0, 1)
 * so the result is fully deterministic and testable.
 */
export function rollCrate(rarityRoll: number, itemRoll: number): CrateRoll {
  const rarity = pickRarity(rarityRoll);
  const pool = CRATE_POOL[rarity];
  const idx = Math.min(pool.length - 1, Math.floor(itemRoll * pool.length));
  return { item: pool[idx]!, rarity };
}
