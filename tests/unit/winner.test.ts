import { describe, expect, it } from "vitest";

import { pickWinnerId } from "@/lib/proposals/winner";

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
