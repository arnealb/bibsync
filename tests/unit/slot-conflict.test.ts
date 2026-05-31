import { describe, expect, it } from "vitest";

import { conflictingSlot } from "@/lib/slots";

describe("conflictingSlot", () => {
  it("blocks a free lunch proposal near the lunch slot (12:00)", () => {
    expect(conflictingSlot("lunch", "12:30")?.key).toBe("middageten");
    expect(conflictingSlot("lunch", "12:00")?.key).toBe("middageten");
  });

  it("blocks a coffee proposal near any coffee slot", () => {
    expect(conflictingSlot("coffee", "10:30")?.key).toBe("ochtendpauze");
    expect(conflictingSlot("coffee", "15:45")?.key).toBe("middagpauze");
  });

  it("allows a proposal far from every same-type slot", () => {
    // 13:30 is >90 min from the 12:00 lunch slot.
    expect(conflictingSlot("lunch", "13:45")).toBeNull();
    // Coffee at 13:00 sits in the gap between the 10:30 and 15:30 slots.
    expect(conflictingSlot("coffee", "13:00")).toBeNull();
  });

  it("never blocks the 'other' type (no fixed slot)", () => {
    expect(conflictingSlot("other", "12:00")).toBeNull();
    expect(conflictingSlot("other", "15:30")).toBeNull();
  });

  it("matches by type — a dinner at the 15:30 coffee slot is allowed", () => {
    // 15:30 is the middagpauze (coffee) slot, but the dinner slot is at 18:30.
    expect(conflictingSlot("dinner", "15:30")).toBeNull();
  });

  it("blocks free lunch across the whole 12:00–13:00 window (default 12:30 ±30)", () => {
    expect(conflictingSlot("lunch", "12:00")?.key).toBe("middageten");
    expect(conflictingSlot("lunch", "13:00")?.key).toBe("middageten");
    expect(conflictingSlot("lunch", "11:45")).toBeNull();
    expect(conflictingSlot("lunch", "13:15")).toBeNull();
  });
});
