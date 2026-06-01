/**
 * Merge Valley tuning — a single-player merge puzzle ("Bib-tuin").
 *
 * Loop: tap the Toverbron (generator) to spend energy and spawn a tier-1 item,
 * drag/tap two identical items together to merge them up a tier, and deliver
 * requested items to fill orders for bibcoins. Energy regenerates for free over
 * time (the pacing gate) and can be topped up with bibcoins (a coin **sink**);
 * orders pay a modest, hourly-capped reward (a bounded **faucet**).
 */

export const BOARD_COLS = 6;
export const BOARD_ROWS = 7;
export const BOARD_CELLS = BOARD_COLS * BOARD_ROWS;

/** Where the permanent generator sits on a fresh board. */
export const GENERATOR_CELL = Math.floor(BOARD_CELLS / 2);

/** Energy: the pacing gate. One spawn costs one energy. */
export const ENERGY_MAX = 50;
export const ENERGY_PER_SPAWN = 1;
/** Free regeneration: +1 energy per this many ms (2 min), capped at ENERGY_MAX. */
export const ENERGY_REGEN_MS = 120_000;

/** Buying energy with bibcoins — the coin sink. */
export const ENERGY_REFILL_AMOUNT = 30;
export const ENERGY_REFILL_COST = 60;

/** Generator display glyph (never appears in a merge chain). */
export const GENERATOR_EMOJI = "🪄";

export interface Family {
  key: string;
  name: string;
  /** Emoji per tier; index 0 = tier 1. Length = number of tiers. */
  tiers: string[];
}

/** Merge chains. Each family's items merge upward through its tiers. */
export const FAMILIES: Family[] = [
  { key: "tuin", name: "Tuin", tiers: ["🌱", "🌿", "☘️", "🌷", "🌸", "🌳"] },
  { key: "fruit", name: "Fruit", tiers: ["🫐", "🍒", "🍓", "🍎", "🍈", "🍉"] },
];

export const FAMILY_BY_KEY = new Map(FAMILIES.map((f) => [f.key, f]));

/** Highest tier (1-based) a family can reach. */
export function maxTier(familyKey: string): number {
  return FAMILY_BY_KEY.get(familyKey)?.tiers.length ?? 0;
}

/** Emoji for a given item, or "" if unknown. */
export function itemEmoji(familyKey: string, tier: number): string {
  return FAMILY_BY_KEY.get(familyKey)?.tiers[tier - 1] ?? "";
}

/** Orders request items in this (achievable) tier range. */
export const ORDER_MIN_TIER = 2;
export const ORDER_MAX_TIER = 4;
export const ORDER_SLOTS = 3;

/** Coin reward for delivering an order of the given tier (index = tier). */
export const ORDER_REWARD_BY_TIER: Record<number, number> = {
  2: 8,
  3: 20,
  4: 45,
};

/** A filled order also tops up this much energy (keeps the loop going). */
export const ORDER_ENERGY_REWARD = 5;

/** Shared with the arcade hourly cap (ARCADE_HOURLY_CAP) — orders can't farm. */
export const MERGE_ORDER_REASON = "merge_order";
