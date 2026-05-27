import { describe, expect, it } from "vitest";

import { presentTally } from "@/lib/proposals/present-tally";
import type { Vote, VoteValue } from "@/types/database";

function vote(userId: string, value: VoteValue): Vote {
  return {
    proposal_id: "p1",
    user_id: userId,
    vote: value,
    voted_at: "2026-05-27T20:00:00.000Z",
  };
}

describe("presentTally", () => {
  it("counts only present voters, denominator = present headcount", () => {
    // 5 present; 3 yes, 2 no among them.
    const present = new Set(["a", "b", "c", "d", "e"]);
    const votes = [
      vote("a", "yes"),
      vote("b", "yes"),
      vote("c", "yes"),
      vote("d", "no"),
      vote("e", "no"),
    ];
    const tally = presentTally(votes, present);
    expect(tally.total).toBe(5);
    expect(tally.counts.yes).toBe(3);
    expect(tally.counts.no).toBe(2);
    expect(tally.counts.maybe).toBe(0);
  });

  it("ignores votes from members who are not present", () => {
    const present = new Set(["a", "b"]);
    const votes = [
      vote("a", "yes"),
      vote("b", "no"),
      vote("ghost", "yes"), // not present → does not count
    ];
    const tally = presentTally(votes, present);
    expect(tally.total).toBe(2);
    expect(tally.counts.yes).toBe(1);
    expect(tally.counts.no).toBe(1);
  });

  it("counts present members who haven't voted in the denominator only", () => {
    const present = new Set(["a", "b", "c"]);
    const votes = [vote("a", "yes")];
    const tally = presentTally(votes, present);
    expect(tally.total).toBe(3);
    expect(tally.counts.yes).toBe(1);
    expect(tally.counts.no).toBe(0);
  });

  it("is empty when nobody is present", () => {
    const tally = presentTally([vote("a", "yes")], new Set());
    expect(tally.total).toBe(0);
    expect(tally.counts.yes).toBe(0);
  });
});
