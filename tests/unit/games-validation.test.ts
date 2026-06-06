import { describe, expect, it } from "vitest";

import { submitScoreSchema } from "@/lib/validation/games";

describe("submitScoreSchema", () => {
  const baseInput = {
    roomId: "11111111-1111-1111-8111-111111111111",
    gameKey: "snake" as const,
    score: 10,
  };

  it("accepts a valid input", () => {
    expect(submitScoreSchema.safeParse(baseInput).success).toBe(true);
  });

  it("accepts the skill-game keys", () => {
    for (const gameKey of [
      "snake",
      "flappy",
      "tetris",
      "2048",
      "minesweeper_easy",
      "minesweeper_medium",
      "minesweeper_hard",
    ] as const) {
      expect(
        submitScoreSchema.safeParse({ ...baseInput, gameKey }).success,
      ).toBe(true);
    }
  });

  it("rejects the retired single minesweeper key", () => {
    expect(
      submitScoreSchema.safeParse({ ...baseInput, gameKey: "minesweeper" })
        .success,
    ).toBe(false);
  });

  it("accepts a coins-only run (lost minesweeper game)", () => {
    expect(
      submitScoreSchema.safeParse({
        ...baseInput,
        gameKey: "minesweeper_hard",
        coinsOnly: true,
      }).success,
    ).toBe(true);
  });

  it("rejects a non-uuid roomId", () => {
    expect(
      submitScoreSchema.safeParse({ ...baseInput, roomId: "abc" }).success,
    ).toBe(false);
  });

  it("rejects an unknown gameKey", () => {
    expect(
      submitScoreSchema.safeParse({ ...baseInput, gameKey: "pacman" }).success,
    ).toBe(false);
  });

  it("rejects a negative score", () => {
    expect(
      submitScoreSchema.safeParse({ ...baseInput, score: -1 }).success,
    ).toBe(false);
  });

  it("rejects a non-integer score", () => {
    expect(
      submitScoreSchema.safeParse({ ...baseInput, score: 1.5 }).success,
    ).toBe(false);
  });

  it("rejects scores above the sanity cap", () => {
    expect(
      submitScoreSchema.safeParse({ ...baseInput, score: 100_001 }).success,
    ).toBe(false);
  });
});
