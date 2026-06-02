import { describe, expect, it } from "vitest";

import { initials, matchGuess, normalizeName } from "@/lib/voetbal/match";
import { STAT_PLAYERS } from "@/lib/voetbal/players";
import { QUIZ_QUESTIONS } from "@/lib/voetbal/quiz";

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

describe("stat player data", () => {
  it("every player has a positive value and at least one club + accept", () => {
    for (const p of STAT_PLAYERS) {
      expect(p.value).toBeGreaterThan(0);
      expect(p.clubs.length).toBeGreaterThan(0);
      expect(p.accept.length).toBeGreaterThan(0);
    }
  });

  it("each player is solvable by at least one of its accepted answers", () => {
    STAT_PLAYERS.forEach((p, i) => {
      expect(matchGuess([{ accept: p.accept }], p.accept[0])).toBe(0);
      expect(i).toBeGreaterThanOrEqual(0);
    });
  });
});

describe("quiz data", () => {
  it("every question has a valid correct index and ≥2 options", () => {
    for (const q of QUIZ_QUESTIONS) {
      expect(q.options.length).toBeGreaterThanOrEqual(2);
      expect(q.correct).toBeGreaterThanOrEqual(0);
      expect(q.correct).toBeLessThan(q.options.length);
    }
  });
});
