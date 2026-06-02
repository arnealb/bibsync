import { describe, expect, it } from "vitest";

import {
  formatScreenTime,
  screenTimeCoins,
  toMinutes,
} from "@/lib/screen-time/format";

describe("screen-time format", () => {
  it("floors seconds to whole minutes", () => {
    expect(toMinutes(0)).toBe(0);
    expect(toMinutes(59)).toBe(0);
    expect(toMinutes(60)).toBe(1);
    expect(toMinutes(119)).toBe(1);
    expect(toMinutes(3600)).toBe(60);
  });

  it("clamps negative input to zero", () => {
    expect(toMinutes(-100)).toBe(0);
  });

  it("formats minutes-only durations", () => {
    expect(formatScreenTime(0)).toBe("0 min");
    expect(formatScreenTime(45 * 60)).toBe("45 min");
    expect(formatScreenTime(59 * 60 + 59)).toBe("59 min");
  });

  it("formats durations with hours", () => {
    expect(formatScreenTime(60 * 60)).toBe("1 u 0 min");
    expect(formatScreenTime(2 * 3600 + 5 * 60)).toBe("2 u 5 min");
  });

  it("rewards 10 coins per full minute", () => {
    expect(screenTimeCoins(0)).toBe(0);
    expect(screenTimeCoins(59)).toBe(0);
    expect(screenTimeCoins(60)).toBe(10);
    expect(screenTimeCoins(10 * 60)).toBe(100);
  });

  it("caps the daily coin reward at 720 minutes", () => {
    expect(screenTimeCoins(720 * 60)).toBe(7200);
    expect(screenTimeCoins(1000 * 60)).toBe(7200);
  });
});
