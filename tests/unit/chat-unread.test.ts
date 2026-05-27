import { describe, expect, it } from "vitest";

import { formatUnreadBadge } from "@/lib/chat/unread";

describe("formatUnreadBadge", () => {
  it("is empty when there is nothing unread", () => {
    expect(formatUnreadBadge(0)).toBe("");
    expect(formatUnreadBadge(-3)).toBe("");
  });

  it("shows the exact count up to 99", () => {
    expect(formatUnreadBadge(1)).toBe("1");
    expect(formatUnreadBadge(2)).toBe("2");
    expect(formatUnreadBadge(99)).toBe("99");
  });

  it("caps large counts at 99+", () => {
    expect(formatUnreadBadge(100)).toBe("99+");
    expect(formatUnreadBadge(5000)).toBe("99+");
  });
});
