import { describe, expect, it } from "vitest";

import {
  HILO_RANKS,
  drawCard,
  guessWins,
  hiloPayout,
  optionMultiplier,
  winChance,
  winCount,
} from "@/lib/hilo/engine";

describe("winCount", () => {
  it("counts ranks strictly above/below (ties excluded)", () => {
    expect(winCount("higher", 8)).toBe(6); // 9..14
    expect(winCount("lower", 8)).toBe(6); // 2..7
    expect(winCount("higher", 14)).toBe(0); // nothing above the ace
    expect(winCount("lower", 2)).toBe(0); // nothing below the two
  });
});

describe("optionMultiplier", () => {
  it("is the fair-with-edge factor and ≥ ~1.07 when enabled", () => {
    expect(optionMultiplier("higher", 8)).toBeCloseTo(0.99 / (6 / 13), 6);
    expect(optionMultiplier("higher", 2)).toBeGreaterThan(1); // 12/13 chance
  });

  it("is 0 (disabled) for an impossible guess", () => {
    expect(optionMultiplier("higher", 14)).toBe(0);
    expect(optionMultiplier("lower", 2)).toBe(0);
  });
});

describe("guessWins", () => {
  it("higher needs strictly greater, lower strictly less; ties lose", () => {
    expect(guessWins("higher", 7, 9)).toBe(true);
    expect(guessWins("higher", 7, 7)).toBe(false);
    expect(guessWins("lower", 7, 3)).toBe(true);
    expect(guessWins("lower", 7, 7)).toBe(false);
  });
});

describe("house edge holds", () => {
  it("every enabled guess has EV ≤ 1 (fair × edge)", () => {
    for (let card = 2; card <= 14; card++) {
      for (const dir of ["higher", "lower"] as const) {
        const m = optionMultiplier(dir, card);
        if (m === 0) continue;
        const ev = winChance(dir, card) * m;
        expect(ev).toBeLessThanOrEqual(1 + 1e-9);
      }
    }
  });
});

describe("drawCard", () => {
  it("stays within 2..14", () => {
    expect(drawCard(() => 0)).toBe(2);
    expect(drawCard(() => 0.999999)).toBe(2 + HILO_RANKS - 1);
  });
});

describe("hiloPayout", () => {
  it("floors bet × multiplier", () => {
    expect(hiloPayout(100, 2.14)).toBe(214);
  });
});
