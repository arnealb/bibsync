import { describe, expect, it } from "vitest";

import { sharesToCover } from "@/lib/theft/seizure";

describe("sharesToCover", () => {
  it("rounds up so the shortfall is fully covered", () => {
    expect(sharesToCover(250, 100, 10)).toBe(3); // 3 × 100 ≥ 250
  });

  it("covers an exact multiple without overselling", () => {
    expect(sharesToCover(300, 100, 10)).toBe(3);
  });

  it("is capped at the held shares", () => {
    expect(sharesToCover(10_000, 100, 4)).toBe(4);
  });

  it("sells nothing at a zero or negative price", () => {
    expect(sharesToCover(500, 0, 10)).toBe(0);
    expect(sharesToCover(500, -1, 10)).toBe(0);
  });

  it("sells nothing without a shortfall or without shares", () => {
    expect(sharesToCover(0, 100, 10)).toBe(0);
    expect(sharesToCover(500, 100, 0)).toBe(0);
  });

  it("handles fractional NAV prices", () => {
    expect(sharesToCover(100, 33.4, 10)).toBe(3); // ceil(100 / 33.4) = 3
  });
});
