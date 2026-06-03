import { describe, expect, it } from "vitest";

import { CRASH_MAX_BP } from "@/lib/crash/config";
import {
  crashHasBusted,
  crashMultiplierAtMs,
  crashPayout,
  crashPointBp,
  settleCrash,
} from "@/lib/crash/engine";

describe("crashPointBp", () => {
  it("instant-busts at 1.00x for the lowest rolls", () => {
    expect(crashPointBp(() => 0)).toBe(100);
  });

  it("stays within [100, max] and rises with the roll", () => {
    expect(crashPointBp(() => 0.5)).toBeGreaterThanOrEqual(100);
    expect(crashPointBp(() => 0.99)).toBeGreaterThan(crashPointBp(() => 0.5));
    expect(crashPointBp(() => 0.999999)).toBeLessThanOrEqual(CRASH_MAX_BP);
  });
});

describe("crashMultiplierAtMs", () => {
  it("starts at 1.00x and only rises", () => {
    expect(crashMultiplierAtMs(0)).toBe(100);
    expect(crashMultiplierAtMs(1000)).toBeGreaterThan(100);
    expect(crashMultiplierAtMs(2000)).toBeGreaterThan(crashMultiplierAtMs(1000));
  });
});

describe("settleCrash", () => {
  it("wins when cashing out before the crash", () => {
    // At 1s the multiplier is ~1.40x (140bp); crash at 500bp → still flying.
    const r = settleCrash(140, 1000, 500);
    expect(r.win).toBe(true);
    expect(r.effectiveBp).toBeLessThanOrEqual(crashMultiplierAtMs(1000));
  });

  it("busts when the crash already happened", () => {
    // Crash at 110bp but 2s elapsed (multiplier well past it).
    expect(settleCrash(150, 2000, 110).win).toBe(false);
  });

  it("caps the cash-out to the server-elapsed multiplier (no future-claiming)", () => {
    const r = settleCrash(9999, 1000, 5000);
    expect(r.effectiveBp).toBe(crashMultiplierAtMs(1000));
  });

  it("honours a click that beat the crash even if the request arrived late", () => {
    // Clicked at 1.20x, crash at 1.22x, but the request only lands when the
    // server clock is already at ~1.71x. The click still wins, at 1.20x.
    const late = settleCrash(120, 1600, 122);
    expect(late.win).toBe(true);
    expect(late.effectiveBp).toBe(120);
  });

  it("a click after the crash still loses", () => {
    // Clicked at 1.30x but the crash was at 1.22x.
    expect(settleCrash(130, 1600, 122).win).toBe(false);
  });
});

describe("crashHasBusted", () => {
  it("is true once the multiplier reaches the crash point", () => {
    expect(crashHasBusted(0, 100)).toBe(true); // instant bust
    expect(crashHasBusted(0, 200)).toBe(false);
  });
});

describe("crashPayout", () => {
  it("floors bet × multiplier", () => {
    expect(crashPayout(100, 241)).toBe(241);
    expect(crashPayout(7, 150)).toBe(Math.floor((7 * 150) / 100));
  });
});

describe("house edge holds (no +EV cash-out point)", () => {
  // Brute-force sweep over every cash-out point; needs more than the
  // default 5s when the machine is under load.
  it(
    "a 'cash at t' strategy has EV ≤ the stake for every t",
    { timeout: 30_000 },
    () => {
      // P(crash ≥ t) = 99 / t_bp, payout floors bet × t.
      for (let bp = 110; bp <= CRASH_MAX_BP; bp += 1) {
        for (const bet of [1, 7, 100, 999]) {
          const winProb = Math.min(1, 99 / bp);
          const ev = winProb * crashPayout(bet, bp);
          expect(ev).toBeLessThanOrEqual(bet + 1e-9);
        }
      }
    },
  );
});
