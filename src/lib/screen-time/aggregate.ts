import type { ResolvedLoadout } from "@/lib/cosmetics/resolve";
import { screenTimeCoins } from "@/lib/screen-time/format";

/** A raw screen-time row (one user, one day). */
export interface ScreenTimeRow {
  user_id: string;
  day: string;
  seconds: number;
}

/** Identity of a room member for the overview. */
export interface MemberInfo {
  userId: string;
  name: string;
  avatarUrl: string | null;
  loadout: ResolvedLoadout | null;
}

/** A member's aggregated screen time across all days. */
export interface MemberScreenTime extends MemberInfo {
  totalSeconds: number;
  todaySeconds: number;
  /** Bibcoins earned from screen time (summed per-day, so the daily cap holds). */
  totalCoins: number;
}

/** Room-wide screen time for a single day (for the chart). */
export interface DayTotal {
  day: string;
  seconds: number;
}

export interface RoomScreenTime {
  /** Members ranked by total screen time (desc). */
  members: MemberScreenTime[];
  /** Room-wide daily totals over the requested axis (chronological). */
  daily: DayTotal[];
  roomTotalSeconds: number;
  roomTotalCoins: number;
}

/**
 * Aggregate raw screen-time rows into a per-room overview: a ranked member
 * leaderboard (with coins earned) plus a room-wide daily series over `axis`.
 * Pure — `today` and `axis` are passed in so it stays deterministic/testable.
 */
export function aggregateRoomScreenTime(
  rows: ScreenTimeRow[],
  members: MemberInfo[],
  today: string,
  axis: string[],
): RoomScreenTime {
  const memberIds = new Set(members.map((m) => m.userId));
  const scoped = rows.filter((r) => memberIds.has(r.user_id));

  const byUser = new Map<string, ScreenTimeRow[]>();
  for (const row of scoped) {
    const list = byUser.get(row.user_id) ?? [];
    byUser.set(row.user_id, [...list, row]);
  }

  const memberEntries: MemberScreenTime[] = members
    .map((m) => {
      const list = byUser.get(m.userId) ?? [];
      return {
        ...m,
        totalSeconds: list.reduce((sum, r) => sum + r.seconds, 0),
        todaySeconds: list.find((r) => r.day === today)?.seconds ?? 0,
        totalCoins: list.reduce((sum, r) => sum + screenTimeCoins(r.seconds), 0),
      };
    })
    .sort((a, b) => b.totalSeconds - a.totalSeconds);

  const dayTotals = new Map<string, number>();
  for (const row of scoped) {
    dayTotals.set(row.day, (dayTotals.get(row.day) ?? 0) + row.seconds);
  }
  const daily = axis.map((day) => ({ day, seconds: dayTotals.get(day) ?? 0 }));

  return {
    members: memberEntries,
    daily,
    roomTotalSeconds: memberEntries.reduce((s, m) => s + m.totalSeconds, 0),
    roomTotalCoins: memberEntries.reduce((s, m) => s + m.totalCoins, 0),
  };
}
