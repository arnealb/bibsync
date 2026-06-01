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
  it("counts ranks above/below including the tie (same rank wins)", () => {
    expect(winCount("higher", 8)).toBe(7); // 8..14
    expect(winCount("lower", 8)).toBe(7); // 2..8
    expect(winCount("higher", 14)).toBe(1); // only the ace itself (tie)
    expect(winCount("lower", 2)).toBe(1); // only the two itself (tie)
  });
});

describe("optionMultiplier", () => {
  it("is the fair-with-edge factor including the tie", () => {
    expect(optionMultiplier("higher", 8)).toBeCloseTo(0.99 / (7 / 13), 6);
    expect(optionMultiplier("higher", 13)).toBeGreaterThan(1); // K or A → 2/13
  });

  it("no guess is impossible — a tie always wins", () => {
    expect(optionMultiplier("higher", 14)).toBeCloseTo(0.99 / (1 / 13), 6);
    expect(optionMultiplier("lower", 2)).toBeCloseTo(0.99 / (1 / 13), 6);
  });
});

describe("guessWins", () => {
  it("higher needs ≥, lower needs ≤; a tie counts as a win", () => {
    expect(guessWins("higher", 7, 9)).toBe(true);
    expect(guessWins("higher", 7, 7)).toBe(true); // same card → win
    expect(guessWins("higher", 7, 5)).toBe(false);
    expect(guessWins("lower", 7, 3)).toBe(true);
    expect(guessWins("lower", 7, 7)).toBe(true); // same card → win
    expect(guessWins("lower", 7, 9)).toBe(false);
  });
});

describe("house edge holds", () => {
  it("every guess has EV ≤ 1 (fair × edge), tie included", () => {
    for (let card = 2; card <= 14; card++) {
      for (const dir of ["higher", "lower"] as const) {
        const m = optionMultiplier(dir, card);
        if (m === 0) continue;
        const ev = winChance(dir, card) * m;
        expect(ev).toBeLessThanOrEqual(1 + 1e-9);
        expect(ev).toBeCloseTo(0.99, 9); // exactly fair-minus-edge
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
