import { describe, expect, it } from "vitest";

import { hourStartMs, msUntilHourReset } from "@/lib/games/arcade-window";

const SAMPLE = 1_700_000_123_456;

describe("arcade window", () => {
  it("hourStartMs truncates to the hour boundary", () => {
    const start = hourStartMs(SAMPLE);
    expect(start % 3_600_000).toBe(0);
    expect(SAMPLE - start).toBeGreaterThanOrEqual(0);
    expect(SAMPLE - start).toBeLessThan(3_600_000);
  });

  it("hourStartMs is stable within the hour, jumps at the boundary", () => {
    const start = hourStartMs(SAMPLE);
    expect(hourStartMs(start)).toBe(start);
    expect(hourStartMs(start + 3_599_999)).toBe(start);
    expect(hourStartMs(start + 3_600_000)).toBe(start + 3_600_000);
  });

  it("msUntilHourReset complements the hour, within (0, 3.6M]", () => {
    const start = hourStartMs(SAMPLE);
    expect(msUntilHourReset(start)).toBe(3_600_000);
    expect(msUntilHourReset(start + 1)).toBe(3_599_999);
    const r = msUntilHourReset(SAMPLE);
    expect(r).toBeGreaterThan(0);
    expect(r).toBeLessThanOrEqual(3_600_000);
  });
});
