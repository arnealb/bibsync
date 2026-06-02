import { createClient } from "@/lib/supabase/server";
import { todayInBrussels } from "@/lib/time";

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
