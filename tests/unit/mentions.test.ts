import { describe, expect, it } from "vitest";

import { mentionedUserIds, splitMentions } from "@/lib/chat/mentions";

const MEMBERS = [
  { id: "u1", name: "Arne" },
  { id: "u2", name: "Sven" },
  { id: "u3", name: "Jan Peter" },
];

describe("mentionedUserIds", () => {
  it("matches a name case-insensitively", () => {
    expect(mentionedUserIds("hey @arne kom je?", MEMBERS)).toEqual(["u1"]);
  });

  it("matches multiple mentions", () => {
    expect(mentionedUserIds("@Arne @Sven yo", MEMBERS).sort()).toEqual([
      "u1",
      "u2",
    ]);
  });

  it("does not match a name that's only a prefix of a longer word", () => {
    expect(mentionedUserIds("@arnested is niet arne", MEMBERS)).toEqual([]);
  });

  it("matches names containing a space", () => {
    expect(mentionedUserIds("ok @Jan Peter", MEMBERS)).toEqual(["u3"]);
  });

  it("returns nothing without a mention", () => {
    expect(mentionedUserIds("gewoon een bericht", MEMBERS)).toEqual([]);
  });
});

describe("splitMentions", () => {
  const names = new Set(["arne", "sven"]);

  it("flags known @mentions and leaves the rest as text", () => {
    const parts = splitMentions("hi @arne en @nobody", names);
    expect(parts).toEqual([
      { text: "hi ", mention: false },
      { text: "@arne", mention: true },
      { text: " en ", mention: false },
      { text: "@nobody", mention: false },
    ]);
  });

  it("returns the whole string as one part when there are no mentions", () => {
    expect(splitMentions("plain text", names)).toEqual([
      { text: "plain text", mention: false },
    ]);
  });
});
