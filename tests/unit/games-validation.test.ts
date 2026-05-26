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

  it("rejects a non-uuid roomId", () => {
    const result = submitScoreSchema.safeParse({ ...baseInput, roomId: "abc" });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown gameKey", () => {
    const result = submitScoreSchema.safeParse({
      ...baseInput,
      gameKey: "tetris",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a negative score", () => {
    const result = submitScoreSchema.safeParse({ ...baseInput, score: -1 });
    expect(result.success).toBe(false);
  });

  it("rejects a non-integer score", () => {
    const result = submitScoreSchema.safeParse({ ...baseInput, score: 1.5 });
    expect(result.success).toBe(false);
  });

  it("rejects scores above the sanity cap", () => {
    const result = submitScoreSchema.safeParse({
      ...baseInput,
      score: 100_001,
    });
    expect(result.success).toBe(false);
  });
});
