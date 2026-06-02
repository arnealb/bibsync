import { createClient } from "@/lib/supabase/server";
import { todayInBrussels } from "@/lib/time";

export interface ScreenTimeSummary {
  /** Seconds of screen time logged today (Brussels day). */
  todaySeconds: number;
  /** Seconds of screen time logged across all days. */
  totalSeconds: number;
}

/**
 * The caller's screen time: today's total and the all-time total. Reads the
 * user's own rows (RLS-scoped); returns zeroes when nothing is logged yet.
 */
export async function getScreenTime(
  userId: string,
): Promise<ScreenTimeSummary> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("screen_time")
    .select("day, seconds")
    .eq("user_id", userId);

  if (error) {
    console.error("[getScreenTime]", error);
    return { todaySeconds: 0, totalSeconds: 0 };
  }

  const today = todayInBrussels();
  const rows = data ?? [];
  return {
    todaySeconds: rows.find((r) => r.day === today)?.seconds ?? 0,
    totalSeconds: rows.reduce((sum, r) => sum + r.seconds, 0),
  };
}
