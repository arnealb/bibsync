import { createClient } from "@/lib/supabase/server";
import { getRoomMembers } from "@/lib/rooms/queries";
import type { GameKey } from "@/lib/validation/games";

export interface LeaderboardEntry {
  userId: string;
  name: string;
  avatarUrl: string | null;
  bestScore: number;
}

/**
 * Top scores per user in a room for a given game, descending. Joins with
 * the existing member list so we don't need a separate profile fetch.
 */
export async function getRoomLeaderboard(
  roomId: string,
  gameKey: GameKey,
  limit = 10,
): Promise<LeaderboardEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("game_scores")
    .select("user_id, score")
    .eq("room_id", roomId)
    .eq("game_key", gameKey);

  if (error) {
    console.error("[getRoomLeaderboard]", error);
    return [];
  }

  const bestByUser = new Map<string, number>();
  for (const row of data ?? []) {
    const current = bestByUser.get(row.user_id) ?? -1;
    if (row.score > current) bestByUser.set(row.user_id, row.score);
  }
  if (bestByUser.size === 0) return [];

  const members = await getRoomMembers(roomId);
  const memberById = new Map(members.map((m) => [m.user_id, m]));

  const entries: LeaderboardEntry[] = [];
  for (const [userId, bestScore] of bestByUser) {
    const member = memberById.get(userId);
    entries.push({
      userId,
      name: member?.profile?.display_name ?? "—",
      avatarUrl: member?.profile?.avatar_url ?? null,
      bestScore,
    });
  }
  entries.sort((a, b) => b.bestScore - a.bestScore);
  return entries.slice(0, limit);
}

/** The caller's best score in this room for this game, or null. */
export async function getMyBestScore(
  roomId: string,
  userId: string,
  gameKey: GameKey,
): Promise<number | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("game_scores")
    .select("score")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .eq("game_key", gameKey)
    .order("score", { ascending: false })
    .limit(1);

  if (error) {
    console.error("[getMyBestScore]", error);
    return null;
  }
  return data?.[0]?.score ?? null;
}
