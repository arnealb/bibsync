import { describe, expect, it } from "vitest";

import {
  ACTIVE_RARITIES,
  CRATE_POOL,
  CRATE_PRICE,
  DUP_REFUND_FRACTION,
  RARITY_WEIGHTS,
  type Rarity,
} from "@/lib/crates/config";
import { pickRarity, rollCrate } from "@/lib/crates/engine";

describe("CRATE_POOL", () => {
  it("excludes premium titles and effects (no cheap +EV exploit)", () => {
    for (const items of Object.values(CRATE_POOL)) {
      for (const item of items) {
        expect(item.type).not.toBe("title");
        expect(item.type).not.toBe("effect");
      }
    }
  });

  it("every active rarity has at least one item", () => {
    for (const rarity of ACTIVE_RARITIES) {
      expect(CRATE_POOL[rarity].length).toBeGreaterThan(0);
    }
  });

  it("is a sink: first-copy EV does not exceed the crate price", () => {
    const total = ACTIVE_RARITIES.reduce((s, r) => s + RARITY_WEIGHTS[r], 0);
    const ev = ACTIVE_RARITIES.reduce((sum, rarity) => {
      const pool = CRATE_POOL[rarity];
      const avg = pool.reduce((s, i) => s + i.price, 0) / pool.length;
      return sum + (RARITY_WEIGHTS[rarity] / total) * avg;
    }, 0);
    // Even getting a brand-new item every time must not print coins.
    expect(ev).toBeLessThanOrEqual(CRATE_PRICE);
  });

  it("duplicate refund is strictly less than the price (always a net cost)", () => {
    expect(Math.floor(CRATE_PRICE * DUP_REFUND_FRACTION)).toBeLessThan(
      CRATE_PRICE,
    );
  });
});

describe("pickRarity", () => {
  it("maps the bottom of the range to the first active rarity", () => {
    expect(pickRarity(0)).toBe(ACTIVE_RARITIES[0]);
  });

  it("maps the top of the range to the last active rarity", () => {
    expect(pickRarity(0.999999)).toBe(
      ACTIVE_RARITIES[ACTIVE_RARITIES.length - 1],
    );
  });

  it("clamps out-of-range rolls instead of throwing", () => {
    expect(ACTIVE_RARITIES).toContain(pickRarity(-1));
    expect(ACTIVE_RARITIES).toContain(pickRarity(5));
  });

  it("respects the weight ordering over many samples", () => {
    const counts: Record<Rarity, number> = { common: 0, rare: 0, epic: 0 };
    const N = 20_000;
    for (let i = 0; i < N; i++) counts[pickRarity((i + 0.5) / N)]++;
    // Common is the heaviest weight, epic the lightest.
    expect(counts.common).toBeGreaterThan(counts.rare);
    expect(counts.rare).toBeGreaterThan(counts.epic);
  });
});

describe("rollCrate", () => {
  it("always returns an item from the rolled rarity's pool", () => {
    const N = 1000;
    for (let i = 0; i < N; i++) {
      const { item, rarity } = rollCrate((i + 0.5) / N, (i * 7 + 0.5) / N);
      expect(CRATE_POOL[rarity].map((c) => c.id)).toContain(item.id);
    }
  });

  it("picks the last pool item at the top of the item roll", () => {
    const { item, rarity } = rollCrate(0, 0.999999);
    const pool = CRATE_POOL[rarity];
    expect(item.id).toBe(pool[pool.length - 1]!.id);
  });
});
