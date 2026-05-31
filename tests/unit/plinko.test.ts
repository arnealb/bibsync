import { describe, expect, it } from "vitest";

import {
  PLINKO_MULTIPLIERS,
  PLINKO_RISKS,
  PLINKO_ROWS_OPTIONS,
} from "@/lib/plinko/config";
import {
  dropBall,
  plinkoMultipliers,
  plinkoPayout,
} from "@/lib/plinko/engine";

describe("PLINKO_MULTIPLIERS tables", () => {
  for (const rows of PLINKO_ROWS_OPTIONS) {
    for (const risk of PLINKO_RISKS) {
      it(`${rows} rows / ${risk} has rows+1 symmetric entries`, () => {
        const table = PLINKO_MULTIPLIERS[rows][risk];
        expect(table).toHaveLength(rows + 1);
        expect([...table].reverse()).toEqual(table);
        expect(table.every((m) => m > 0)).toBe(true);
      });

      it(`${rows} rows / ${risk} pays the most at the edges`, () => {
        const table = PLINKO_MULTIPLIERS[rows][risk];
        const mid = Math.floor(table.length / 2);
        expect(table[0]).toBeGreaterThanOrEqual(table[mid]);
        expect(table[0]).toBe(Math.max(...table));
      });
    }
  }
});

describe("dropBall", () => {
  it("produces a path of length rows and a slot = count of rights", () => {
    const { path, slot } = dropBall(
      12,
      makeRng([0.9, 0.1, 0.9, 0.1, 0.9, 0.1, 0.9, 0.1, 0.9, 0.1, 0.9, 0.1]),
    );
    expect(path).toHaveLength(12);
    expect(slot).toBe(path.filter((d) => d === "R").length);
  });

  it("maps the RNG threshold correctly (<0.5 = left)", () => {
    expect(dropBall(16, () => 0.1).slot).toBe(0); // every bounce left
    expect(dropBall(16, () => 0.9).slot).toBe(16); // every bounce right
  });

  it("keeps the slot within [0, rows]", () => {
    const rng = makeRng([0.2, 0.8, 0.4, 0.6, 0.5, 0.49, 0.51, 0.3]);
    const { slot } = dropBall(8, rng);
    expect(slot).toBeGreaterThanOrEqual(0);
    expect(slot).toBeLessThanOrEqual(8);
  });
});

describe("plinkoPayout", () => {
  it("floors bet × the landed slot's multiplier", () => {
    const m = plinkoMultipliers(12, "medium")[0];
    expect(plinkoPayout(100, 12, "medium", 0)).toBe(Math.floor(100 * m));
  });

  it("a sub-1 multiplier still pays out at the minimum bet (no floor-to-zero)", () => {
    // 0.2× × 10 = 2; the 1-coin bet that floored to 0 is blocked by PLINKO_MIN_BET.
    expect(plinkoPayout(10, 16, "high", 8)).toBe(2);
  });

  it("a center hit on a <1 slot loses coins", () => {
    const mid = Math.floor((16 + 1) / 2);
    expect(plinkoPayout(100, 16, "high", mid)).toBeLessThan(100);
  });
});

describe("house edge holds (RTP ≤ 1)", () => {
  /** Binomial C(n, k). */
  function choose(n: number, k: number): number {
    let c = 1;
    for (let i = 0; i < k; i++) c = (c * (n - i)) / (i + 1);
    return c;
  }

  for (const rows of PLINKO_ROWS_OPTIONS) {
    for (const risk of PLINKO_RISKS) {
      it(`${rows} rows / ${risk} returns ≤ 100% to the player`, () => {
        const table = PLINKO_MULTIPLIERS[rows][risk];
        // Slot k has probability C(rows,k) / 2^rows (a fair Galton board).
        const rtp = table.reduce(
          (sum, m, k) => sum + (choose(rows, k) / 2 ** rows) * m,
          0,
        );
        expect(rtp).toBeLessThanOrEqual(1);
        expect(rtp).toBeGreaterThan(0.9); // sane edge, not a rip-off
      });
    }
  }
});

/** Cycles through a fixed list of [0,1) values. */
function makeRng(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}
