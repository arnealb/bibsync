import { describe, expect, it } from "vitest";

import {
  canConnect,
  isCleared,
  makeBoard,
  removePair,
  tilesLeft,
  type Grid,
} from "@/lib/petconnect/engine";

const g = (rows: string[]): Grid =>
  rows.map((row) => row.split("").map(Number));

describe("canConnect", () => {
  it("connects adjacent equal tiles", () => {
    const grid = g(["0000", "0110", "0000"]);
    expect(canConnect(grid, { r: 1, c: 1 }, { r: 1, c: 2 })).not.toBeNull();
  });

  it("connects in a straight line through empty cells", () => {
    const grid = g(["00000", "01010", "00000"]);
    expect(canConnect(grid, { r: 1, c: 1 }, { r: 1, c: 3 })).not.toBeNull();
  });

  it("connects around a blocker with one turn", () => {
    const grid = g(["00000", "01220", "00200", "00100", "00000"]);
    const path = canConnect(grid, { r: 1, c: 1 }, { r: 3, c: 2 });
    expect(path).not.toBeNull();
  });

  it("rejects opposite corners that need three turns", () => {
    const grid = g(["0000", "0120", "0210", "0000"]);
    expect(canConnect(grid, { r: 1, c: 1 }, { r: 2, c: 2 })).toBeNull();
  });

  it("rejects different pets", () => {
    const grid = g(["0000", "0120", "0000"]);
    expect(canConnect(grid, { r: 1, c: 1 }, { r: 1, c: 2 })).toBeNull();
  });
});

describe("board", () => {
  function lcg(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 2 ** 32;
    };
  }

  it("fills the inner grid with pairs and an empty border", () => {
    const grid = makeBoard(4, 4, 4, lcg(42));
    expect(tilesLeft(grid)).toBe(16);
    // border is empty
    expect(grid[0]!.every((v) => v === 0)).toBe(true);
    expect(grid.every((row) => row[0] === 0)).toBe(true);
    // each pet appears an even number of times
    const counts = new Map<number, number>();
    for (const v of grid.flat()) if (v !== 0) counts.set(v, (counts.get(v) ?? 0) + 1);
    for (const n of counts.values()) expect(n % 2).toBe(0);
  });

  it("clears when the last pair is removed", () => {
    let grid = g(["0000", "0110", "0000"]);
    grid = removePair(grid, { r: 1, c: 1 }, { r: 1, c: 2 });
    expect(isCleared(grid)).toBe(true);
  });
});
