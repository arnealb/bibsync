import {
  aggregateRoomScreenTime,
  type RoomScreenTime,
} from "@/lib/screen-time/aggregate";
import { getRoomMembers } from "@/lib/rooms/queries";
import { createClient } from "@/lib/supabase/server";
import { isoDatePlus, todayInBrussels } from "@/lib/time";

/** Number of days shown in the room overview chart. */
const CHART_DAYS = 14;

export interface ScreenTimeDay {
  /** Brussels day (YYYY-MM-DD). */
  day: string;
  /** Seconds of screen time logged that day. */
  seconds: number;
}

export interface ScreenTimeSummary {
  /** Seconds of screen time logged today (Brussels day). */
  todaySeconds: number;
  /** Seconds of screen time logged across all days. */
  totalSeconds: number;
  /** Per-day breakdown, most recent day first. */
  days: ScreenTimeDay[];
}

/**
 * The caller's screen time: today's total, the all-time total, and a per-day
 * breakdown (newest first). Reads the user's own rows (RLS-scoped); returns
 * zeroes/empty when nothing is logged yet.
 */
export async function getScreenTime(
  userId: string,
): Promise<ScreenTimeSummary> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("screen_time")
    .select("day, seconds")
    .eq("user_id", userId)
    .order("day", { ascending: false });

  if (error) {
    console.error("[getScreenTime]", error);
    return { todaySeconds: 0, totalSeconds: 0, days: [] };
  }

  const today = todayInBrussels();
  const days = (data ?? []).map((r) => ({ day: r.day, seconds: r.seconds }));
  return {
    todaySeconds: days.find((d) => d.day === today)?.seconds ?? 0,
    totalSeconds: days.reduce((sum, d) => sum + d.seconds, 0),
    days,
  };
}

/**
 * Screen-time overview for everyone in a room: a ranked leaderboard (with coins
 * earned) plus the room's daily totals for the chart. Relies on the
 * `screen_time_roommates` RLS policy so a member may read fellow members' rows.
 */
export async function getRoomScreenTime(
  roomId: string,
): Promise<RoomScreenTime> {
  const members = await getRoomMembers(roomId);
  const memberInfos = members.map((m) => ({
    userId: m.user_id,
    name: m.profile?.display_name ?? "—",
    avatarUrl: m.profile?.avatar_url ?? null,
    loadout: m.loadout,
  }));

  const axis = Array.from({ length: CHART_DAYS }, (_, i) =>
    isoDatePlus(-(CHART_DAYS - 1 - i)),
  );

  if (memberInfos.length === 0) {
    return aggregateRoomScreenTime([], [], todayInBrussels(), axis);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("screen_time")
    .select("user_id, day, seconds")
    .in(
      "user_id",
      memberInfos.map((m) => m.userId),
    );

  if (error) {
    console.error("[getRoomScreenTime]", error);
    return aggregateRoomScreenTime([], memberInfos, todayInBrussels(), axis);
  }

  return aggregateRoomScreenTime(data ?? [], memberInfos, todayInBrussels(), axis);
}
