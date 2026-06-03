import { describe, expect, it } from "vitest";

import { US_STATES } from "@/lib/usstates/states";
import { matchState, normalizeGuess } from "@/lib/usstates/match";

describe("usstates data", () => {
  it("has exactly 50 states with unique codes and names", () => {
    expect(US_STATES).toHaveLength(50);
    expect(new Set(US_STATES.map((s) => s.code)).size).toBe(50);
    expect(new Set(US_STATES.map((s) => s.name)).size).toBe(50);
  });

  it("uses two-letter uppercase postal codes", () => {
    for (const s of US_STATES) expect(s.code).toMatch(/^[A-Z]{2}$/);
  });
});

describe("normalizeGuess", () => {
  it("lowercases, trims and collapses internal whitespace", () => {
    expect(normalizeGuess("  New   YORK ")).toBe("new york");
    expect(normalizeGuess("California")).toBe("california");
  });
});

describe("matchState (strict, English only)", () => {
  const none = new Set<string>();

  it("matches every canonical name case-insensitively", () => {
    for (const s of US_STATES) {
      expect(matchState(s.name, none)).toBe(s.code);
      expect(matchState(s.name.toLowerCase(), none)).toBe(s.code);
    }
  });

  it("tolerates surrounding and doubled whitespace", () => {
    expect(matchState("  north   carolina ", none)).toBe("NC");
  });

  it("rejects postal abbreviations", () => {
    expect(matchState("NY", none)).toBeNull();
    expect(matchState("ca", none)).toBeNull();
  });

  it("rejects typos (no fuzzy matching)", () => {
    expect(matchState("Californa", none)).toBeNull();
    expect(matchState("newyork", none)).toBeNull();
  });

  it("returns null for an already-found state (no double count)", () => {
    expect(matchState("California", new Set(["CA"]))).toBeNull();
  });
});
