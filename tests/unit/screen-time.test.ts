import { describe, expect, it } from "vitest";

import {
  aggregateRoomScreenTime,
  type MemberInfo,
} from "@/lib/screen-time/aggregate";
import {
  formatScreenTime,
  screenTimeCoins,
  toMinutes,
} from "@/lib/screen-time/format";

const member = (userId: string, name: string): MemberInfo => ({
  userId,
  name,
  avatarUrl: null,
  loadout: null,
});

describe("screen-time format", () => {
  it("floors seconds to whole minutes", () => {
    expect(toMinutes(0)).toBe(0);
    expect(toMinutes(59)).toBe(0);
    expect(toMinutes(60)).toBe(1);
    expect(toMinutes(119)).toBe(1);
    expect(toMinutes(3600)).toBe(60);
  });

  it("clamps negative input to zero", () => {
    expect(toMinutes(-100)).toBe(0);
  });

  it("formats minutes-only durations", () => {
    expect(formatScreenTime(0)).toBe("0 min");
    expect(formatScreenTime(45 * 60)).toBe("45 min");
    expect(formatScreenTime(59 * 60 + 59)).toBe("59 min");
  });

  it("formats durations with hours", () => {
    expect(formatScreenTime(60 * 60)).toBe("1 u 0 min");
    expect(formatScreenTime(2 * 3600 + 5 * 60)).toBe("2 u 5 min");
  });

  it("rewards 10 coins per full minute", () => {
    expect(screenTimeCoins(0)).toBe(0);
    expect(screenTimeCoins(59)).toBe(0);
    expect(screenTimeCoins(60)).toBe(10);
    expect(screenTimeCoins(10 * 60)).toBe(100);
  });

  it("caps the daily coin reward at 720 minutes", () => {
    expect(screenTimeCoins(720 * 60)).toBe(7200);
    expect(screenTimeCoins(1000 * 60)).toBe(7200);
  });
});

describe("aggregateRoomScreenTime", () => {
  const axis = ["2026-05-01", "2026-05-02", "2026-05-03"];
  const today = "2026-05-03";
  const members = [member("a", "Ann"), member("b", "Bob")];

  it("ranks members by total screen time, newest day = today", () => {
    const rows = [
      { user_id: "a", day: "2026-05-01", seconds: 600 },
      { user_id: "a", day: "2026-05-03", seconds: 120 },
      { user_id: "b", day: "2026-05-03", seconds: 1800 },
    ];
    const out = aggregateRoomScreenTime(rows, members, today, axis);

    expect(out.members.map((m) => m.userId)).toEqual(["b", "a"]);
    const ann = out.members.find((m) => m.userId === "a")!;
    expect(ann.totalSeconds).toBe(720);
    expect(ann.todaySeconds).toBe(120);
    // 10 min (600s) + 2 min (120s) = 100 + 20 coins
    expect(ann.totalCoins).toBe(120);
  });

  it("builds a room-wide daily series over the axis", () => {
    const rows = [
      { user_id: "a", day: "2026-05-02", seconds: 300 },
      { user_id: "b", day: "2026-05-02", seconds: 300 },
    ];
    const out = aggregateRoomScreenTime(rows, members, today, axis);
    expect(out.daily).toEqual([
      { day: "2026-05-01", seconds: 0 },
      { day: "2026-05-02", seconds: 600 },
      { day: "2026-05-03", seconds: 0 },
    ]);
    expect(out.roomTotalSeconds).toBe(600);
  });

  it("ignores rows from users who are not members", () => {
    const rows = [{ user_id: "ghost", day: today, seconds: 9999 }];
    const out = aggregateRoomScreenTime(rows, members, today, axis);
    expect(out.roomTotalSeconds).toBe(0);
    expect(out.members).toHaveLength(2);
  });
});
