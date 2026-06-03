import type { ResolvedLoadout } from "@/lib/cosmetics/resolve";
import { compareRuns, isBetterRun, type ScoreRun } from "@/lib/games/rank";
import { createClient } from "@/lib/supabase/server";
import { getRoomMembers } from "@/lib/rooms/queries";
import type { GameKey } from "@/lib/validation/games";

export interface LeaderboardEntry {
  userId: string;
  name: string;
  avatarUrl: string | null;
  loadout: ResolvedLoadout | null;
  bestScore: number;
  /** Seconds to the best run's last point (USA Staten), or null. */
  durationSeconds: number | null;
  /** Whether the shown best score was achieved with the autopilot. */
  cheated: boolean;
}

export interface LeaderboardData {
  /** Best score per user (cheated runs included, flagged). */
  full: LeaderboardEntry[];
  /** Best honest (non-cheated) score per user. */
  honest: LeaderboardEntry[];
}

interface ScoreRow {
  user_id: string;
  score: number;
  cheated: boolean;
  duration_seconds: number | null;
}

/** All score rows for a game, tolerating a not-yet-migrated time column. */
async function fetchScoreRows(
  roomId: string,
  gameKey: GameKey,
): Promise<ScoreRow[] | null> {
  const supabase = await createClient();
  const timed = await supabase
    .from("game_scores")
    .select("user_id, score, cheated, duration_seconds")
    .eq("room_id", roomId)
    .eq("game_key", gameKey);
  if (!timed.error) return timed.data;

  // duration_seconds (migration 0060) not applied yet — select without it.
  const bare = await supabase
    .from("game_scores")
    .select("user_id, score, cheated")
    .eq("room_id", roomId)
    .eq("game_key", gameKey);
  if (bare.error) {
    console.error("[getRoomLeaderboard]", bare.error);
    return null;
  }
  return bare.data.map((row) => ({ ...row, duration_seconds: null }));
}

/**
 * Two leaderboards for a game in a room: the full board (cheated runs flagged)
 * and the honest board (cheated runs excluded), both descending. Score ties
 * rank the fastest run first (see `compareRuns`).
 */
export async function getRoomLeaderboard(
  roomId: string,
  gameKey: GameKey,
  limit = 10,
): Promise<LeaderboardData> {
  const rows = await fetchScoreRows(roomId, gameKey);
  if (!rows) return { full: [], honest: [] };

  const bestOverall = new Map<string, ScoreRun>();
  const bestHonest = new Map<string, ScoreRun>();
  for (const row of rows) {
    const run = { score: row.score, durationSeconds: row.duration_seconds };
    const overall = bestOverall.get(row.user_id);
    if (!overall || isBetterRun(run, overall)) {
      bestOverall.set(row.user_id, run);
    }
    if (!row.cheated) {
      const honest = bestHonest.get(row.user_id);
      if (!honest || isBetterRun(run, honest)) {
        bestHonest.set(row.user_id, run);
      }
    }
  }
  if (bestOverall.size === 0) return { full: [], honest: [] };

  const members = await getRoomMembers(roomId);
  const memberById = new Map(members.map((m) => [m.user_id, m]));
  const toEntry = (userId: string, run: ScoreRun): LeaderboardEntry => {
    const member = memberById.get(userId);
    return {
      userId,
      name: member?.profile?.display_name ?? "—",
      avatarUrl: member?.profile?.avatar_url ?? null,
      loadout: member?.loadout ?? null,
      bestScore: run.score,
      durationSeconds: run.durationSeconds,
      cheated: false,
    };
  };
  const byBestRun = (a: LeaderboardEntry, b: LeaderboardEntry) =>
    compareRuns(
      { score: a.bestScore, durationSeconds: a.durationSeconds },
      { score: b.bestScore, durationSeconds: b.durationSeconds },
    );

  const full: LeaderboardEntry[] = [...bestOverall.entries()]
    .map(([userId, run]) => {
      const honestRun = bestHonest.get(userId);
      return {
        ...toEntry(userId, run),
        // The shown best beats the user's honest best → it was a cheated run.
        cheated: !honestRun || isBetterRun(run, honestRun),
      };
    })
    .sort(byBestRun)
    .slice(0, limit);

  const honest: LeaderboardEntry[] = [...bestHonest.entries()]
    .map(([userId, run]) => toEntry(userId, run))
    .sort(byBestRun)
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
