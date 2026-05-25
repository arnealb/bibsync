import { describe, expect, it } from "vitest";

import { isGifUrl } from "@/lib/chat/gif";

describe("isGifUrl", () => {
  it("accepts image/gif URLs", () => {
    expect(isGifUrl("https://media.giphy.com/media/x/giphy.gif")).toBe(true);
    expect(isGifUrl("https://example.com/cat.png")).toBe(true);
    expect(isGifUrl("https://tenor.com/view/abc")).toBe(true);
    expect(isGifUrl("https://example.com/pic.webp?x=1")).toBe(true);
  });

  it("rejects plain text and non-image URLs", () => {
    expect(isGifUrl("hallo allemaal")).toBe(false);
    expect(isGifUrl("https://example.com check dit")).toBe(false);
    expect(isGifUrl("https://example.com/article")).toBe(false);
    expect(isGifUrl("not a url")).toBe(false);
  });
});
