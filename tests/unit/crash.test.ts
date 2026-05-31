import { describe, expect, it } from "vitest";

import {
  CRASH_MAX_TARGET_BP,
  CRASH_MIN_TARGET_BP,
} from "@/lib/crash/config";
import {
  crashPayout,
  crashPointBp,
  crashWin,
  crashWinChance,
} from "@/lib/crash/engine";

describe("crashPointBp", () => {
  it("instant-busts at 1.00x for the lowest rolls", () => {
    expect(crashPointBp(() => 0)).toBe(100);
  });

  it("stays within [100, max]", () => {
    for (const u of [0, 0.1, 0.5, 0.9, 0.999, 0.99999]) {
      const bp = crashPointBp(() => u);
      expect(bp).toBeGreaterThanOrEqual(100);
      expect(bp).toBeLessThanOrEqual(CRASH_MAX_TARGET_BP);
    }
  });

  it("rises with the roll", () => {
    expect(crashPointBp(() => 0.99)).toBeGreaterThan(crashPointBp(() => 0.5));
  });
});

describe("crashWin", () => {
  it("wins when the crash reaches the target", () => {
    expect(crashWin(200, 200)).toBe(true);
    expect(crashWin(200, 250)).toBe(true);
    expect(crashWin(200, 199)).toBe(false);
  });
});

describe("crashPayout", () => {
  it("floors bet × target", () => {
    expect(crashPayout(100, 250)).toBe(250);
    expect(crashPayout(7, 150)).toBe(Math.floor((7 * 150) / 100));
  });
});

describe("house edge holds (no +EV target)", () => {
  it("every target has EV ≤ the stake", () => {
    for (let bp = CRASH_MIN_TARGET_BP; bp <= CRASH_MAX_TARGET_BP; bp += 1) {
      for (const bet of [1, 7, 13, 100, 999]) {
        const ev = crashWinChance(bp) * crashPayout(bet, bp);
        expect(ev).toBeLessThanOrEqual(bet + 1e-9);
      }
    }
  });
});
