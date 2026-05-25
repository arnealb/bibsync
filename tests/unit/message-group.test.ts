import { describe, expect, it } from "vitest";

import { groupMessages, type ChatMessage } from "@/lib/messages/group";

function message(
  id: string,
  authorId: string,
  createdAt: string,
): ChatMessage {
  return {
    id,
    room_id: "r",
    author_id: authorId,
    content: "x",
    created_at: createdAt,
  };
}

describe("groupMessages", () => {
  it("groups consecutive messages from the same author within 5 minutes", () => {
    const groups = groupMessages([
      message("1", "A", "2026-05-25T12:00:00Z"),
      message("2", "A", "2026-05-25T12:02:00Z"),
      message("3", "B", "2026-05-25T12:03:00Z"),
      message("4", "A", "2026-05-25T12:20:00Z"),
    ]);

    expect(groups).toHaveLength(3);
    expect(groups[0].items.map((m) => m.id)).toEqual(["1", "2"]);
    expect(groups[1].authorId).toBe("B");
    expect(groups[2].items.map((m) => m.id)).toEqual(["4"]);
  });

  it("returns no groups for an empty list", () => {
    expect(groupMessages([])).toEqual([]);
  });
});
