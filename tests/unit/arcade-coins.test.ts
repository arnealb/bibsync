import { describe, expect, it } from "vitest";

import { arcadeCoins, cappedCoins } from "@/lib/games/arcade-coins";

describe("arcadeCoins", () => {
  it("applies the per-game rate per event (snake/flappy 3, tetris 8)", () => {
    expect(arcadeCoins("snake", 17)).toBe(51); // 17 × 3
    expect(arcadeCoins("flappy", 4)).toBe(12); // 4 × 3
    expect(arcadeCoins("tetris", 9)).toBe(72); // 9 × 8
  });

  it("is 12 per new-highest-tile milestone for 2048", () => {
    expect(arcadeCoins("2048", 2)).toBe(0); // start tile, no milestone
    expect(arcadeCoins("2048", 4)).toBe(12); // 1 × 12
    expect(arcadeCoins("2048", 256)).toBe(84); // 7 × 12
    expect(arcadeCoins("2048", 2048)).toBe(120); // 10 × 12
  });

  it("never pays for a zero or negative score", () => {
    expect(arcadeCoins("snake", 0)).toBe(0);
    expect(arcadeCoins("flappy", -3)).toBe(0);
  });
});

describe("cappedCoins", () => {
  it("pays the full amount under the cap", () => {
    expect(cappedCoins(100, 0, 250)).toBe(100);
    expect(cappedCoins(100, 100, 250)).toBe(100);
  });

  it("clamps to the remaining headroom", () => {
    expect(cappedCoins(100, 200, 250)).toBe(50);
  });

  it("pays nothing at or over the cap, never negative", () => {
    expect(cappedCoins(100, 250, 250)).toBe(0);
    expect(cappedCoins(100, 300, 250)).toBe(0);
  });
});
