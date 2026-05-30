import { describe, expect, it } from "vitest";

import {
  DISPLAY_NAME_CHANGE_COST,
  displayNameSchema,
} from "@/lib/validation/profile";

describe("displayNameSchema", () => {
  it("accepts a normal name", () => {
    const result = displayNameSchema.safeParse("Arne");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe("Arne");
  });

  it("trims surrounding whitespace", () => {
    const result = displayNameSchema.safeParse("  Arne  ");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe("Arne");
  });

  it("rejects an empty name", () => {
    expect(displayNameSchema.safeParse("").success).toBe(false);
  });

  it("rejects a whitespace-only name", () => {
    expect(displayNameSchema.safeParse("   ").success).toBe(false);
  });

  it("accepts a name of exactly 40 characters", () => {
    expect(displayNameSchema.safeParse("a".repeat(40)).success).toBe(true);
  });

  it("rejects a name longer than 40 characters", () => {
    expect(displayNameSchema.safeParse("a".repeat(41)).success).toBe(false);
  });
});

describe("DISPLAY_NAME_CHANGE_COST", () => {
  it("charges 500 bibcoins per change", () => {
    expect(DISPLAY_NAME_CHANGE_COST).toBe(500);
  });
});
