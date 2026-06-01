import { describe, expect, it } from "vitest";

import { WHEEL_RISKS, WHEEL_SEGMENTS } from "@/lib/wheel/config";
import { spinWheel, wheelPayout } from "@/lib/wheel/engine";

describe("WHEEL_SEGMENTS", () => {
  for (const risk of WHEEL_RISKS) {
    it(`${risk} has a house edge (mean multiplier ≤ 1)`, () => {
      const segs = WHEEL_SEGMENTS[risk];
      const mean = segs.reduce((s, m) => s + m, 0) / segs.length;
      // Uniform pick → RTP = mean. Must keep an edge but not be a rip-off.
      expect(mean).toBeLessThanOrEqual(1);
      expect(mean).toBeGreaterThan(0.9);
    });

    it(`${risk} has 20 segments`, () => {
      expect(WHEEL_SEGMENTS[risk]).toHaveLength(20);
    });
  }

  it("higher risk has a bigger top multiplier than lower risk", () => {
    expect(Math.max(...WHEEL_SEGMENTS.high)).toBeGreaterThan(
      Math.max(...WHEEL_SEGMENTS.medium),
    );
    expect(Math.max(...WHEEL_SEGMENTS.medium)).toBeGreaterThan(
      Math.max(...WHEEL_SEGMENTS.low),
    );
  });
});

describe("spinWheel", () => {
  it("returns an in-range segment index", () => {
    expect(spinWheel("low", () => 0)).toBe(0);
    expect(spinWheel("low", () => 0.999999)).toBe(WHEEL_SEGMENTS.low.length - 1);
  });
});

describe("wheelPayout", () => {
  it("floors bet × the landed multiplier", () => {
    const idx = WHEEL_SEGMENTS.medium.findIndex((m) => m === 5);
    expect(wheelPayout(100, "medium", idx)).toBe(500);
  });

  it("a 0× segment pays nothing", () => {
    const idx = WHEEL_SEGMENTS.high.findIndex((m) => m === 0);
    expect(wheelPayout(100, "high", idx)).toBe(0);
  });
});
