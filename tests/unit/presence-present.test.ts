import { describe, expect, it } from "vitest";

import { LOCATION_FRESH_MS } from "@/lib/presence/location";
import {
  isPresent,
  presenceVerdict,
  presenceVerdictSortKey,
} from "@/lib/presence/present";

const NOW = Date.parse("2026-05-27T12:00:00.000Z");
const TODAY = "2026-05-27";
function ago(ms: number): string {
  return new Date(NOW - ms).toISOString();
}

describe("presenceVerdict", () => {
  it("is unknown without a row", () => {
    expect(presenceVerdict(undefined, TODAY, NOW)).toBe("unknown");
  });

  it("prefers a fresh location 'here'", () => {
    const v = presenceVerdict(
      { at_location: true, location_checked_at: ago(1000), checked_in_on: null },
      TODAY,
      NOW,
    );
    expect(v).toBe("here");
  });

  it("counts a check-in today as present even without location", () => {
    const v = presenceVerdict(
      { at_location: null, location_checked_at: null, checked_in_on: TODAY },
      TODAY,
      NOW,
    );
    expect(v).toBe("checked-in");
    expect(isPresent(v)).toBe(true);
  });

  it("a check-in wins over a stale/away location", () => {
    const v = presenceVerdict(
      { at_location: false, location_checked_at: ago(1000), checked_in_on: TODAY },
      TODAY,
      NOW,
    );
    expect(v).toBe("checked-in");
  });

  it("yesterday's check-in does not count", () => {
    const v = presenceVerdict(
      {
        at_location: null,
        location_checked_at: null,
        checked_in_on: "2026-05-26",
      },
      TODAY,
      NOW,
    );
    expect(v).toBe("unknown");
    expect(isPresent(v)).toBe(false);
  });

  it("is away for a fresh far location with no check-in", () => {
    const v = presenceVerdict(
      { at_location: false, location_checked_at: ago(1000), checked_in_on: null },
      TODAY,
      NOW,
    );
    expect(v).toBe("away");
    expect(isPresent(v)).toBe(false);
  });

  it("stale location with no check-in is unknown", () => {
    const v = presenceVerdict(
      {
        at_location: true,
        location_checked_at: ago(LOCATION_FRESH_MS + 1),
        checked_in_on: null,
      },
      TODAY,
      NOW,
    );
    expect(v).toBe("unknown");
  });
});

describe("presenceVerdictSortKey", () => {
  it("orders here < checked-in < unknown < away", () => {
    expect(presenceVerdictSortKey("here")).toBeLessThan(
      presenceVerdictSortKey("checked-in"),
    );
    expect(presenceVerdictSortKey("checked-in")).toBeLessThan(
      presenceVerdictSortKey("unknown"),
    );
    expect(presenceVerdictSortKey("unknown")).toBeLessThan(
      presenceVerdictSortKey("away"),
    );
  });
});
