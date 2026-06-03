import { describe, expect, it } from "vitest";

import {
  DICE_MAX_BP,
  DICE_MIN_BP,
  DICE_OUTCOMES,
} from "@/lib/dice/config";
import {
  diceMultiplier,
  dicePayout,
  diceWin,
  diceWinChance,
  rollDice,
} from "@/lib/dice/engine";

describe("diceWinChance", () => {
  it("under and over are complementary", () => {
    expect(diceWinChance(5000, "under") + diceWinChance(5000, "over")).toBe(1);
  });

  it("under 50.00 is a coin flip", () => {
    expect(diceWinChance(5000, "under")).toBe(0.5);
  });

  it("over a high target is a small chance", () => {
    expect(diceWinChance(9000, "over")).toBeCloseTo(0.1, 10);
  });
});

describe("diceMultiplier", () => {
  it("a 50% chance pays ~1.98x (1% edge)", () => {
    expect(diceMultiplier(5000, "over")).toBeCloseTo(0.99 / 0.5, 10);
  });

  it("grows as the win chance shrinks", () => {
    expect(diceMultiplier(9000, "over")).toBeGreaterThan(
      diceMultiplier(5000, "over"),
    );
  });
});

describe("diceWin", () => {
  it("under wins below the target, loses at/above it", () => {
    expect(diceWin(4999, 5000, "under")).toBe(true);
    expect(diceWin(5000, 5000, "under")).toBe(false);
    expect(diceWin(5001, 5000, "under")).toBe(false);
  });

  it("over wins at/above the target, loses below it", () => {
    expect(diceWin(5000, 5000, "over")).toBe(true);
    expect(diceWin(4999, 5000, "over")).toBe(false);
  });
});

describe("rollDice", () => {
  it("stays within 0..9999", () => {
    expect(rollDice(() => 0)).toBe(0);
    expect(rollDice(() => 0.99999999)).toBe(DICE_OUTCOMES - 1);
  });
});

describe("house edge holds (no +EV target)", () => {
  // Brute-force sweep over every target; needs more than the default 5s
  // when the machine is under load.
  it(
    "every target/direction has EV ≤ the stake",
    { timeout: 30_000 },
    () => {
      for (let bp = DICE_MIN_BP; bp <= DICE_MAX_BP; bp++) {
        for (const dir of ["under", "over"] as const) {
          for (const bet of [1, 7, 13, 50, 100, 999]) {
            const ev = diceWinChance(bp, dir) * dicePayout(bet, bp, dir);
            expect(ev).toBeLessThanOrEqual(bet + 1e-9);
          }
        }
      }
    },
  );
});
