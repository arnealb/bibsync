import { describe, expect, it } from "vitest";

import {
  breakEndsAt,
  breakRemainingMs,
  isBreakActive,
  recentPushers,
} from "@/lib/instant-break/status";
import type { InstantBreak, InstantBreakPush } from "@/types/database";

const T0 = Date.parse("2026-05-25T10:00:00.000Z");

function makeBreak(startedAt: string, duration: number): InstantBreak {
  return {
    id: "b1",
    room_id: "r1",
    triggered_by: "u1",
    duration_minutes: duration,
    started_at: startedAt,
    created_at: startedAt,
  };
}

function makePush(userId: string, createdAt: string): InstantBreakPush {
  return {
    id: `${userId}-${createdAt}`,
    room_id: "r1",
    user_id: userId,
    duration_minutes: 15,
    created_at: createdAt,
  };
}

describe("breakEndsAt / isBreakActive / breakRemainingMs", () => {
  const b = makeBreak("2026-05-25T10:00:00.000Z", 15);

  it("ends duration minutes after it started", () => {
    expect(breakEndsAt(b)).toBe(T0 + 15 * 60_000);
  });

  it("is active before the end and inactive after", () => {
    expect(isBreakActive(b, T0 + 5 * 60_000)).toBe(true);
    expect(isBreakActive(b, T0 + 15 * 60_000)).toBe(false);
    expect(isBreakActive(b, T0 + 20 * 60_000)).toBe(false);
  });

  it("never reports negative remaining time", () => {
    expect(breakRemainingMs(b, T0 + 5 * 60_000)).toBe(10 * 60_000);
    expect(breakRemainingMs(b, T0 + 99 * 60_000)).toBe(0);
  });
});

describe("recentPushers", () => {
  it("counts each member once within the window", () => {
    const pushes = [
      makePush("a", "2026-05-25T10:00:00.000Z"),
      makePush("a", "2026-05-25T10:00:30.000Z"), // same person, still one
      makePush("b", "2026-05-25T10:00:45.000Z"),
    ];
    const pushers = recentPushers(pushes, T0 + 60_000, 90);
    expect(pushers).toEqual(new Set(["a", "b"]));
  });

  it("ignores presses older than the window", () => {
    const pushes = [
      makePush("a", "2026-05-25T09:58:00.000Z"), // 120s ago — out
      makePush("b", "2026-05-25T10:00:30.000Z"), // 30s ago — in
    ];
    const pushers = recentPushers(pushes, T0 + 60_000, 90);
    expect(pushers).toEqual(new Set(["b"]));
  });
});
