import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  presenceSortKey,
  presenceView,
  type PresenceView,
} from "@/lib/presence/view";
import type { Presence, PresenceStatus } from "@/types/database";

function row(status: PresenceStatus, updatedAt: string, backAt: string | null = null): Presence {
  return {
    room_id: "r",
    user_id: "u",
    status,
    back_at: backAt,
    updated_at: updatedAt,
  };
}

describe("presenceView", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-25T12:00:00+02:00")); // Brussels noon
  });
  afterEach(() => vi.useRealTimers());

  it("resets anything set before today 04:00 to studying", () => {
    expect(presenceView(row("done", "2026-05-25T02:00:00+02:00"))).toEqual({
      kind: "status",
      status: "studying",
      backAt: null,
    });
  });

  it("keeps a fresh status with its back_at", () => {
    expect(
      presenceView(row("break", "2026-05-25T11:30:00+02:00", "12:00")),
    ).toEqual({ kind: "status", status: "break", backAt: "12:00" });
  });

  it("shows last-seen when older than 4 hours (but after the reset)", () => {
    const view = presenceView(row("lunch", "2026-05-25T05:00:00+02:00"));
    expect(view.kind).toBe("lastSeen");
  });

  it("defaults to studying when there is no row", () => {
    expect(presenceView(undefined)).toEqual({
      kind: "status",
      status: "studying",
      backAt: null,
    });
  });
});

describe("presenceSortKey", () => {
  const status = (s: PresenceStatus): PresenceView => ({
    kind: "status",
    status: s,
    backAt: null,
  });

  it("orders active first, then away, done, then last-seen", () => {
    expect(presenceSortKey(status("studying"))).toBe(0);
    expect(presenceSortKey(status("break"))).toBe(0);
    expect(presenceSortKey(status("away"))).toBe(1);
    expect(presenceSortKey(status("done"))).toBe(2);
    expect(presenceSortKey({ kind: "lastSeen", time: "10:00" })).toBe(3);
  });
});
