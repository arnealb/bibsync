import { describe, expect, it } from "vitest";

import { initials, matchGuess, normalizeName } from "@/lib/voetbal/match";

const players = [
  { accept: ["de bruyne", "kevin de bruyne", "kdb"] },
  { accept: ["mbappe", "kylian mbappe"] },
  { accept: ["ronaldo", "cr7"] },
];

describe("normalizeName", () => {
  it("strips accents, case, spaces and punctuation", () => {
    expect(normalizeName("Mbappé")).toBe("mbappe");
    expect(normalizeName("De Bruyne")).toBe("debruyne");
    expect(normalizeName("  KDB  ")).toBe("kdb");
    expect(normalizeName("Modrić")).toBe("modric");
  });
});

describe("initials", () => {
  it("builds dotted initials from a display name", () => {
    expect(initials("Kevin De Bruyne")).toBe("K.D.B.");
    expect(initials("Pelé")).toBe("P.");
    expect(initials("Vinícius Júnior")).toBe("V.J.");
  });
});

describe("matchGuess", () => {
  it("matches regardless of case, accents and spacing", () => {
    expect(matchGuess(players, "De Bruyne")).toBe(0);
    expect(matchGuess(players, "kevin de bruyne")).toBe(0);
    expect(matchGuess(players, "KDB")).toBe(0);
    expect(matchGuess(players, "  mbappé ")).toBe(1);
    expect(matchGuess(players, "CR7")).toBe(2);
  });

  it("returns -1 for unknown or empty guesses", () => {
    expect(matchGuess(players, "messi")).toBe(-1);
    expect(matchGuess(players, "   ")).toBe(-1);
    expect(matchGuess(players, "")).toBe(-1);
  });
});
