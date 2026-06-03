import { describe, expect, it } from "vitest";

import { compareRuns, isBetterRun, mmss } from "@/lib/games/rank";

describe("isBetterRun", () => {
  it("a higher score always wins, regardless of time", () => {
    expect(
      isBetterRun({ score: 50, durationSeconds: 299 }, { score: 49, durationSeconds: 10 }),
    ).toBe(true);
    expect(
      isBetterRun({ score: 49, durationSeconds: 10 }, { score: 50, durationSeconds: 299 }),
    ).toBe(false);
  });

  it("on equal scores the faster (lower) time wins", () => {
    expect(
      isBetterRun({ score: 50, durationSeconds: 120 }, { score: 50, durationSeconds: 180 }),
    ).toBe(true);
    expect(
      isBetterRun({ score: 50, durationSeconds: 180 }, { score: 50, durationSeconds: 120 }),
    ).toBe(false);
  });

  it("on equal scores a timed run beats an untimed one", () => {
    expect(
      isBetterRun({ score: 50, durationSeconds: 299 }, { score: 50, durationSeconds: null }),
    ).toBe(true);
    expect(
      isBetterRun({ score: 50, durationSeconds: null }, { score: 50, durationSeconds: 299 }),
    ).toBe(false);
  });

  it("identical runs are not better than each other", () => {
    expect(
      isBetterRun({ score: 50, durationSeconds: null }, { score: 50, durationSeconds: null }),
    ).toBe(false);
    expect(
      isBetterRun({ score: 50, durationSeconds: 120 }, { score: 50, durationSeconds: 120 }),
    ).toBe(false);
  });
});

describe("compareRuns", () => {
  it("sorts by score desc, then time asc, untimed last", () => {
    const runs = [
      { score: 50, durationSeconds: null },
      { score: 50, durationSeconds: 180 },
      { score: 49, durationSeconds: 5 },
      { score: 50, durationSeconds: 120 },
    ];
    const sorted = [...runs].sort(compareRuns);
    expect(sorted).toEqual([
      { score: 50, durationSeconds: 120 },
      { score: 50, durationSeconds: 180 },
      { score: 50, durationSeconds: null },
      { score: 49, durationSeconds: 5 },
    ]);
  });
});

describe("mmss", () => {
  it("formats seconds as m:ss", () => {
    expect(mmss(0)).toBe("0:00");
    expect(mmss(9)).toBe("0:09");
    expect(mmss(65)).toBe("1:05");
    expect(mmss(300)).toBe("5:00");
  });
});
