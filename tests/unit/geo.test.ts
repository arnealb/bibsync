import { describe, expect, it } from "vitest";

import { distanceMeters, isWithin } from "@/lib/geo";

// De Therminal (UGent, Hoveniersberg 24, Gent).
const THERMINAL = { lat: 51.0444, lng: 3.7276 };

describe("distanceMeters", () => {
  it("is zero for the same point", () => {
    expect(distanceMeters(THERMINAL, THERMINAL)).toBe(0);
  });

  it("matches a known short distance (~111m per 0.001° lat)", () => {
    const d = distanceMeters(THERMINAL, {
      lat: THERMINAL.lat + 0.001,
      lng: THERMINAL.lng,
    });
    expect(d).toBeGreaterThan(105);
    expect(d).toBeLessThan(115);
  });

  it("is symmetric", () => {
    const a = THERMINAL;
    const b = { lat: 51.05, lng: 3.73 };
    expect(distanceMeters(a, b)).toBeCloseTo(distanceMeters(b, a), 6);
  });
});

describe("isWithin", () => {
  it("counts a point inside the radius", () => {
    const near = { lat: THERMINAL.lat + 0.0005, lng: THERMINAL.lng };
    expect(isWithin(near, THERMINAL, 150)).toBe(true);
  });

  it("rejects a point outside the radius", () => {
    const far = { lat: THERMINAL.lat + 0.01, lng: THERMINAL.lng };
    expect(isWithin(far, THERMINAL, 150)).toBe(false);
  });
});
