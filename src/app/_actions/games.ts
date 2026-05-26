"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import type { ActionResult } from "@/app/_actions/types";
import { copy } from "@/lib/copy";
import { getShowCheated } from "@/lib/games/queries";
import { requireRoomAccess } from "@/lib/rooms/queries";
import { createClient } from "@/lib/supabase/server";
import { submitScoreSchema, type SubmitScoreInput } from "@/lib/validation/games";

export async function submitGameScore(
  input: SubmitScoreInput,
): Promise<ActionResult> {
  const parsed = submitScoreSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: copy.games.submitError };
  }

  const access = await requireRoomAccess(parsed.data.roomId);
  if (!access) return { ok: false, error: copy.common.notAuthenticated };

  const supabase = await createClient();
  const { error } = await supabase.from("game_scores").insert({
    room_id: parsed.data.roomId,
    user_id: access.userId,
    game_key: parsed.data.gameKey,
    score: parsed.data.score,
    cheated: parsed.data.cheated ?? false,
  });

  if (error) {
    console.error("[submitGameScore]", error);
    return { ok: false, error: copy.games.submitError };
  }

  revalidatePath(`/app/rooms/${parsed.data.roomId}/games`);
  revalidatePath(`/app/rooms/${parsed.data.roomId}/games/${parsed.data.gameKey}`);
  return { ok: true };
}

const toggleSchema = z.object({ roomId: z.string().uuid() });

type ToggleResult =
  | { ok: true; showCheated: boolean }
  | { ok: false; error: string };

/**
 * Flips this room's shared leaderboard view between showing all scores
 * (cheated runs flagged) and the honest-only view. Applies for everyone.
 */
export async function toggleLeaderboardCheated(
  roomId: string,
): Promise<ToggleResult> {
  const parsed = toggleSchema.safeParse({ roomId });
  if (!parsed.success) return { ok: false, error: copy.common.genericError };

  const access = await requireRoomAccess(roomId);
  if (!access) return { ok: false, error: copy.common.notAuthenticated };

  const next = !(await getShowCheated(roomId));
  const supabase = await createClient();
  const { error } = await supabase
    .from("room_leaderboard_settings")
    .upsert(
      { room_id: roomId, show_cheated: next, updated_at: new Date().toISOString() },
      { onConflict: "room_id" },
    );

  if (error) {
    console.error("[toggleLeaderboardCheated]", error);
    return { ok: false, error: copy.common.genericError };
  }

  revalidatePath(`/app/rooms/${roomId}/games`);
  revalidatePath(`/app/rooms/${roomId}/games/snake`);
  return { ok: true, showCheated: next };
}
