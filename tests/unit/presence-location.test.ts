import { describe, expect, it } from "vitest";

import {
  LOCATION_FRESH_MS,
  locationSortKey,
  locationStatus,
} from "@/lib/presence/location";

const NOW = Date.parse("2026-05-27T12:00:00.000Z");
function ago(ms: number): string {
  return new Date(NOW - ms).toISOString();
}

describe("locationStatus", () => {
  it("is unknown without a row or reading", () => {
    expect(locationStatus(undefined, NOW)).toBe("unknown");
    expect(
      locationStatus({ at_location: null, location_checked_at: null }, NOW),
    ).toBe("unknown");
    expect(
      locationStatus({ at_location: true, location_checked_at: null }, NOW),
    ).toBe("unknown");
  });

  it("reports here/away for a fresh reading", () => {
    expect(
      locationStatus({ at_location: true, location_checked_at: ago(1000) }, NOW),
    ).toBe("here");
    expect(
      locationStatus({ at_location: false, location_checked_at: ago(1000) }, NOW),
    ).toBe("away");
  });

  it("goes unknown once the reading is stale", () => {
    expect(
      locationStatus(
        { at_location: true, location_checked_at: ago(LOCATION_FRESH_MS + 1) },
        NOW,
      ),
    ).toBe("unknown");
  });
});

describe("locationSortKey", () => {
  it("orders here < unknown < away", () => {
    expect(locationSortKey("here")).toBeLessThan(locationSortKey("unknown"));
    expect(locationSortKey("unknown")).toBeLessThan(locationSortKey("away"));
  });
});
