import type { ResolvedLoadout } from "@/lib/cosmetics/resolve";
import { createClient } from "@/lib/supabase/server";
import { getRoomMembers } from "@/lib/rooms/queries";
import type { GameKey } from "@/lib/validation/games";

export interface LeaderboardEntry {
  userId: string;
  name: string;
  avatarUrl: string | null;
  loadout: ResolvedLoadout | null;
  bestScore: number;
  /** Whether the shown best score was achieved with the autopilot. */
  cheated: boolean;
}

export interface LeaderboardData {
  /** Best score per user (cheated runs included, flagged). */
  full: LeaderboardEntry[];
  /** Best honest (non-cheated) score per user. */
  honest: LeaderboardEntry[];
}

/**
 * Two leaderboards for a game in a room: the full board (cheated runs flagged)
 * and the honest board (cheated runs excluded), both descending.
 */
export async function getRoomLeaderboard(
  roomId: string,
  gameKey: GameKey,
  limit = 10,
): Promise<LeaderboardData> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("game_scores")
    .select("user_id, score, cheated")
    .eq("room_id", roomId)
    .eq("game_key", gameKey);

  if (error) {
    console.error("[getRoomLeaderboard]", error);
    return { full: [], honest: [] };
  }

  const bestOverall = new Map<string, number>();
  const bestHonest = new Map<string, number>();
  for (const row of data ?? []) {
    if (row.score > (bestOverall.get(row.user_id) ?? -1)) {
      bestOverall.set(row.user_id, row.score);
    }
    if (!row.cheated && row.score > (bestHonest.get(row.user_id) ?? -1)) {
      bestHonest.set(row.user_id, row.score);
    }
  }
  if (bestOverall.size === 0) return { full: [], honest: [] };

  const members = await getRoomMembers(roomId);
  const memberById = new Map(members.map((m) => [m.user_id, m]));
  const nameOf = (userId: string) =>
    memberById.get(userId)?.profile?.display_name ?? "—";
  const avatarOf = (userId: string) =>
    memberById.get(userId)?.profile?.avatar_url ?? null;
  const loadoutOf = (userId: string) =>
    memberById.get(userId)?.loadout ?? null;

  const full: LeaderboardEntry[] = [...bestOverall.entries()]
    .map(([userId, bestScore]) => ({
      userId,
      name: nameOf(userId),
      avatarUrl: avatarOf(userId),
      loadout: loadoutOf(userId),
      bestScore,
      cheated: bestScore > (bestHonest.get(userId) ?? -1),
    }))
    .sort((a, b) => b.bestScore - a.bestScore)
    .slice(0, limit);

  const honest: LeaderboardEntry[] = [...bestHonest.entries()]
    .map(([userId, bestScore]) => ({
      userId,
      name: nameOf(userId),
      avatarUrl: avatarOf(userId),
      loadout: loadoutOf(userId),
      bestScore,
      cheated: false,
    }))
    .sort((a, b) => b.bestScore - a.bestScore)
    .slice(0, limit);

  return { full, honest };
}

/** Whether this room's leaderboard currently shows cheated runs (default true). */
export async function getShowCheated(roomId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("room_leaderboard_settings")
    .select("show_cheated")
    .eq("room_id", roomId)
    .maybeSingle();
  return data?.show_cheated ?? true;
}

/** The caller's best score in this room for this game (any run), or null. */
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
