import { describe, expect, it } from "vitest";

import { US_PATHS, US_VIEWBOX } from "@/lib/usstates/map";
import { US_STATE_CODES, US_STATES } from "@/lib/usstates/states";

describe("usstates map geometry", () => {
  it("has a non-empty four-part viewBox", () => {
    expect(US_VIEWBOX).toMatch(/^\d/);
    expect(US_VIEWBOX.split(/\s+/)).toHaveLength(4);
  });

  it("has exactly one path per state, codes matching states.ts", () => {
    expect(US_PATHS).toHaveLength(50);
    const pathCodes = new Set(US_PATHS.map((p) => p.code));
    expect(pathCodes.size).toBe(50);
    for (const s of US_STATES) expect(pathCodes.has(s.code)).toBe(true);
    for (const p of US_PATHS) expect(US_STATE_CODES.has(p.code)).toBe(true);
  });

  it("every path has non-empty geometry and a finite label anchor", () => {
    for (const p of US_PATHS) {
      expect(p.d.length).toBeGreaterThan(10);
      expect(Number.isFinite(p.label.x)).toBe(true);
      expect(Number.isFinite(p.label.y)).toBe(true);
    }
  });
});
