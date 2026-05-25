import { describe, expect, it } from "vitest";

import { formatTally, isJokeUser, voteWeight } from "@/lib/proposals/joke";

describe("joke vote weighting", () => {
  it("flags joke users by name (case-insensitive)", () => {
    expect(isJokeUser("Alan")).toBe(true);
    expect(isJokeUser("alan smith")).toBe(true);
    expect(isJokeUser("Chakalaka")).toBe(true);
    expect(isJokeUser("Bob")).toBe(false);
  });

  it("gives joke users half a vote", () => {
    expect(voteWeight("Alan")).toBe(0.5);
    expect(voteWeight("chakalaka fan")).toBe(0.5);
    expect(voteWeight("Alice")).toBe(1);
  });

  it("formats whole and fractional tallies", () => {
    expect(formatTally(3)).toBe("3");
    expect(formatTally(2.5)).toBe("2.5");
    expect(formatTally(0)).toBe("0");
  });
});
