"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import type { ActionResult } from "@/app/_actions/types";
import { earnFromArcade, earnFromPetConnect } from "@/lib/bibcoins/earn";
import { copy } from "@/lib/copy";
import { getShowCheated } from "@/lib/games/queries";
import { requireRoomAccess } from "@/lib/rooms/queries";
import { createClient } from "@/lib/supabase/server";
import { submitScoreSchema, type SubmitScoreInput } from "@/lib/validation/games";

/** True when an insert failed because a (not-yet-migrated) column is missing. */
function isMissingColumn(error: { code?: string } | null): boolean {
  return error?.code === "PGRST204" || error?.code === "42703";
}

export async function submitGameScore(
  input: SubmitScoreInput,
): Promise<ActionResult> {
  const parsed = submitScoreSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: copy.games.submitError };
  }

  const access = await requireRoomAccess(parsed.data.roomId);
  if (!access) return { ok: false, error: copy.common.notAuthenticated };
  if (access.isPilloried) return { ok: false, error: copy.pillory.frozen };

  // coinsOnly runs (e.g. a lost Minesweeper game) earn but never rank.
  if (!parsed.data.coinsOnly) {
    const row = {
      room_id: parsed.data.roomId,
      user_id: access.userId,
      game_key: parsed.data.gameKey,
      score: parsed.data.score,
      cheated: parsed.data.cheated ?? false,
    };
    const supabase = await createClient();
    let { error } = await supabase.from("game_scores").insert({
      ...row,
      duration_seconds: parsed.data.durationSeconds ?? null,
    });
    if (isMissingColumn(error)) {
      // duration_seconds (migration 0060) not applied yet — keep the score.
      ({ error } = await supabase.from("game_scores").insert(row));
    }

    if (error) {
      console.error("[submitGameScore]", error);
      return { ok: false, error: copy.games.submitError };
    }
  }

  if (parsed.data.gameKey === "petconnect") {
    await earnFromPetConnect(access.userId);
  } else if (parsed.data.gameKey !== "usstates") {
    await earnFromArcade(
      access.userId,
      parsed.data.gameKey,
      parsed.data.score,
      parsed.data.cheated ?? false,
    );
  }

  // The three minesweeper difficulty keys share one game page.
  const route = parsed.data.gameKey.startsWith("minesweeper")
    ? "minesweeper"
    : parsed.data.gameKey;
  revalidatePath(`/app/rooms/${parsed.data.roomId}/games`);
  revalidatePath(`/app/rooms/${parsed.data.roomId}/games/${route}`);
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
