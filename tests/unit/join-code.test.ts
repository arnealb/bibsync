import { describe, expect, it } from "vitest";

import {
  generateJoinCode,
  JOIN_CODE_ALPHABET,
  JOIN_CODE_LENGTH,
} from "@/lib/rooms/join-code";

describe("generateJoinCode", () => {
  it("excludes the confusing characters 0/O/1/I/L", () => {
    for (const ch of "01OIL") {
      expect(JOIN_CODE_ALPHABET).not.toContain(ch);
    }
  });

  it("produces codes of the right length using only the alphabet", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateJoinCode();
      expect(code).toHaveLength(JOIN_CODE_LENGTH);
      for (const ch of code) {
        expect(JOIN_CODE_ALPHABET).toContain(ch);
      }
    }
  });
});
