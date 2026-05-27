import { describe, expect, it } from "vitest";

import { decideSlotTime, pickWinnerId } from "@/lib/proposals/winner";

describe("pickWinnerId", () => {
  it("returns the id with the highest yes weight", () => {
    const weights: Record<string, number> = { a: 1, b: 2.5, c: 2 };
    expect(pickWinnerId(["a", "b", "c"], (id) => weights[id] ?? 0)).toBe("b");
  });

  it("returns null when no one voted yes", () => {
    expect(pickWinnerId(["a", "b"], () => 0)).toBeNull();
  });

  it("keeps the first id on a tie", () => {
    expect(pickWinnerId(["a", "b"], () => 2)).toBe("a");
  });
});

describe("decideSlotTime", () => {
  const w = () => 1; // everyone weighs 1

  it("returns null with no suggestions", () => {
    expect(decideSlotTime([], [], w)).toBeNull();
  });

  it("picks the most-preferred time (preferences count as backing)", () => {
    const suggestions = [
      { id: "1", start_time: "15:30", created_by: "a" },
      { id: "2", start_time: "15:30", created_by: "b" },
      { id: "3", start_time: "16:00", created_by: "c" },
    ];
    expect(decideSlotTime(suggestions, [], w)).toBe("15:30");
  });

  it("counts yes-votes on top of preferences", () => {
    const suggestions = [
      { id: "1", start_time: "15:30", created_by: "a" },
      { id: "2", start_time: "16:00", created_by: "b" },
    ];
    // c and d vote yes for 16:00 → 16:00 has 3 backers vs 15:30's 1
    const votes = [
      { proposal_id: "2", user_id: "c", vote: "yes" },
      { proposal_id: "2", user_id: "d", vote: "yes" },
    ];
    expect(decideSlotTime(suggestions, votes, w)).toBe("16:00");
  });

  it("de-duplicates a backer who prefers and votes the same time", () => {
    const suggestions = [
      { id: "1", start_time: "15:30", created_by: "a" },
      { id: "2", start_time: "16:00", created_by: "b" },
    ];
    // a also votes yes on their own time — still one backer for 15:30
    const votes = [{ proposal_id: "1", user_id: "a", vote: "yes" }];
    expect(decideSlotTime(suggestions, votes, w)).toBe("15:30"); // tie → earliest
  });

  it("weights backers (joke half-vote) and breaks ties by earliest time", () => {
    const suggestions = [
      { id: "1", start_time: "10:00", created_by: "alan" }, // weight 0.5
      { id: "2", start_time: "11:00", created_by: "b" }, // weight 1
    ];
    const weight = (uid: string) => (uid === "alan" ? 0.5 : 1);
    expect(decideSlotTime(suggestions, [], weight)).toBe("11:00");
  });
});
