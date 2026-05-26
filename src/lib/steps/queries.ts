import { getRoomMembers } from "@/lib/rooms/queries";
import { createClient } from "@/lib/supabase/server";
import { todayInBrussels } from "@/lib/time";

export interface StepsEntry {
  userId: string;
  name: string;
  avatarUrl: string | null;
  steps: number;
}

export interface StepsBoard {
  today: StepsEntry[];
  allTime: StepsEntry[];
  myToday: number;
}

/** Per-room step leaderboard: totals for today and all-time, plus my total. */
export async function getStepsBoard(
  roomId: string,
  userId: string,
): Promise<StepsBoard> {
  const supabase = await createClient();
  const today = todayInBrussels();
  const { data, error } = await supabase
    .from("step_sessions")
    .select("user_id, steps, recorded_for")
    .eq("room_id", roomId);

  if (error) {
    console.error("[getStepsBoard]", error);
    return { today: [], allTime: [], myToday: 0 };
  }

  const todayTotals = new Map<string, number>();
  const allTotals = new Map<string, number>();
  for (const row of data ?? []) {
    allTotals.set(row.user_id, (allTotals.get(row.user_id) ?? 0) + row.steps);
    if (row.recorded_for === today) {
      todayTotals.set(
        row.user_id,
        (todayTotals.get(row.user_id) ?? 0) + row.steps,
      );
    }
  }

  const members = await getRoomMembers(roomId);
  const memberById = new Map(members.map((m) => [m.user_id, m]));
  const toEntries = (totals: Map<string, number>): StepsEntry[] =>
    [...totals.entries()]
      .map(([uid, steps]) => ({
        userId: uid,
        name: memberById.get(uid)?.profile?.display_name ?? "—",
        avatarUrl: memberById.get(uid)?.profile?.avatar_url ?? null,
        steps,
      }))
      .sort((a, b) => b.steps - a.steps);

  return {
    today: toEntries(todayTotals),
    allTime: toEntries(allTotals),
    myToday: todayTotals.get(userId) ?? 0,
  };
}

/** The caller's Apple Health sync token, if one has been generated. */
export async function getHealthToken(userId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("health_tokens")
    .select("token")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.token ?? null;
}
