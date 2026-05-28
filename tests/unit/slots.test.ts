import { describe, expect, it } from "vitest";

import { averageTime, BREAK_SLOTS } from "@/lib/slots";

describe("averageTime", () => {
  it("returns the fallback when there are no times", () => {
    expect(averageTime([], "10:30")).toBe("10:30");
  });

  it("returns the single time when there is one", () => {
    expect(averageTime(["12:00"], "10:30")).toBe("12:00");
  });

  it("averages and rounds to the nearest 5 minutes", () => {
    expect(averageTime(["10:00", "11:00"], "00:00")).toBe("10:30");
    // 10:30 + 10:45 -> 10:37.5 -> rounds to nearest 5 -> 10:40
    expect(averageTime(["10:30", "10:45"], "00:00")).toBe("10:40");
  });

  it("handles HH:MM:SS values", () => {
    expect(averageTime(["12:00:00", "12:30:00"], "00:00")).toBe("12:15");
  });
});

describe("slot definitions", () => {
  it("has the five fixed break slots with default times on the quarter", () => {
    expect(BREAK_SLOTS.map((s) => s.key)).toEqual([
      "ochtendpauze",
      "middageten",
      "middagpauze",
      "avondeten",
      "avondpauze",
    ]);
    for (const slot of BREAK_SLOTS) {
      expect(slot.defaultTime).toMatch(/^([01]\d|2[0-3]):(00|15|30|45)$/);
    }
  });
});
