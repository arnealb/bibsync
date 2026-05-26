import { describe, expect, it } from "vitest";

import { aggregateByUser, dayTotal } from "@/lib/steps/aggregate";

const TODAY = "2026-05-26";
const YESTERDAY = "2026-05-25";

describe("dayTotal", () => {
  it("takes the highest health total (running daily total)", () => {
    expect(
      dayTotal([
        { steps: 3000, source: "health" },
        { steps: 8200, source: "health" },
        { steps: 7000, source: "health" },
      ]),
    ).toBe(8200);
  });

  it("sums browser increments", () => {
    expect(
      dayTotal([
        { steps: 1200, source: "browser" },
        { steps: 800, source: "browser" },
      ]),
    ).toBe(2000);
  });

  it("combines both sources", () => {
    expect(
      dayTotal([
        { steps: 5000, source: "health" },
        { steps: 300, source: "browser" },
      ]),
    ).toBe(5300);
  });

  it("is zero for no rows", () => {
    expect(dayTotal([])).toBe(0);
  });
});

describe("aggregateByUser", () => {
  it("computes today and all-time per user without double-counting health", () => {
    const { today, allTime } = aggregateByUser(
      [
        // alice: health reported twice today (running total) + yesterday
        { user_id: "alice", steps: 4000, source: "health", recorded_for: TODAY },
        { user_id: "alice", steps: 9100, source: "health", recorded_for: TODAY },
        { user_id: "alice", steps: 6000, source: "health", recorded_for: YESTERDAY },
        // bob: browser increments today
        { user_id: "bob", steps: 500, source: "browser", recorded_for: TODAY },
        { user_id: "bob", steps: 700, source: "browser", recorded_for: TODAY },
      ],
      TODAY,
    );

    expect(today.get("alice")).toBe(9100); // not 4000+9100
    expect(allTime.get("alice")).toBe(9100 + 6000);
    expect(today.get("bob")).toBe(1200);
    expect(allTime.get("bob")).toBe(1200);
  });

  it("omits today's entry for a user with only older days", () => {
    const { today, allTime } = aggregateByUser(
      [{ user_id: "cara", steps: 3000, source: "health", recorded_for: YESTERDAY }],
      TODAY,
    );
    expect(today.has("cara")).toBe(false);
    expect(allTime.get("cara")).toBe(3000);
  });
});
