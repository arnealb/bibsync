import { describe, expect, it } from "vitest";

import { MINES_GRID_SIZE } from "@/lib/mines/config";
import {
  generateMines,
  minesMultiplier,
  minesPayout,
  safeTileCount,
} from "@/lib/mines/engine";

describe("safeTileCount", () => {
  it("is the grid minus the bombs", () => {
    expect(safeTileCount(1)).toBe(24);
    expect(safeTileCount(24)).toBe(1);
  });
});

describe("minesMultiplier", () => {
  it("is 1 before any tile is opened", () => {
    expect(minesMultiplier(3, 0)).toBe(1);
    expect(minesMultiplier(24, 0)).toBe(1);
  });

  it("grows with each safe tile opened", () => {
    const a = minesMultiplier(3, 1);
    const b = minesMultiplier(3, 2);
    const c = minesMultiplier(3, 3);
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
  });

  it("is higher with more bombs at the same depth", () => {
    expect(minesMultiplier(10, 1)).toBeGreaterThan(minesMultiplier(1, 1));
  });

  it("applies the ~1% house edge on the first safe tile", () => {
    // Fair first-tile multiplier with 3 bombs = 25/22 ≈ 1.1364; ×0.99 ≈ 1.125.
    expect(minesMultiplier(3, 1)).toBeCloseTo(1.13, 1);
  });

  it("clearing every safe tile with one bomb pays roughly the whole grid", () => {
    // 24 safe tiles, 1 bomb → fair ≈ 25, ×0.99 ≈ 24.75.
    expect(minesMultiplier(1, 24)).toBeCloseTo(24.75, 1);
  });
});

describe("minesPayout", () => {
  it("floors bet × multiplier to a whole coin", () => {
    expect(minesPayout(100, 3, 1)).toBe(Math.floor(100 * minesMultiplier(3, 1)));
  });

  it("returns the stake when nothing is opened", () => {
    expect(minesPayout(100, 3, 0)).toBe(100);
  });
});

describe("generateMines", () => {
  it("places the requested count of distinct in-range tiles", () => {
    const mines = generateMines(5, () => 0.5);
    expect(mines).toHaveLength(5);
    expect(new Set(mines).size).toBe(5);
    for (const m of mines) {
      expect(m).toBeGreaterThanOrEqual(0);
      expect(m).toBeLessThan(MINES_GRID_SIZE);
    }
  });

  it("returns a sorted array", () => {
    const mines = generateMines(8, makeRng([0.9, 0.1, 0.7, 0.3, 0.5, 0.2, 0.8, 0.4]));
    expect([...mines].sort((a, b) => a - b)).toEqual(mines);
  });

  it("is deterministic for a given RNG sequence", () => {
    expect(generateMines(6, makeRng([0.1, 0.2, 0.3, 0.4, 0.5, 0.6]))).toEqual(
      generateMines(6, makeRng([0.1, 0.2, 0.3, 0.4, 0.5, 0.6])),
    );
  });

  it("can fill the whole board", () => {
    expect(generateMines(MINES_GRID_SIZE, () => 0)).toHaveLength(MINES_GRID_SIZE);
  });
});

/** Cycles through a fixed list of [0,1) values. */
function makeRng(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}
