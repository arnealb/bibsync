import { afterEach, describe, expect, it, vi } from "vitest";

import { endTime, formatTime, isoDatePlus } from "@/lib/time";

afterEach(() => {
  vi.useRealTimers();
});

describe("time helpers", () => {
  it("trims SQL time values to HH:MM", () => {
    expect(formatTime("12:30:00")).toBe("12:30");
    expect(formatTime("09:15")).toBe("09:15");
  });

  it("computes end time, wrapping past midnight", () => {
    expect(endTime("12:30", 45)).toBe("13:15");
    expect(endTime("23:30", 60)).toBe("00:30");
  });

  it("returns ISO dates offset from today", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-25T12:00:00+02:00"));
    expect(isoDatePlus(0)).toBe("2026-05-25");
    expect(isoDatePlus(1)).toBe("2026-05-26");
    expect(isoDatePlus(7)).toBe("2026-06-01");
  });
});
