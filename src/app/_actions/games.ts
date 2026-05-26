"use server";

import { revalidatePath } from "next/cache";

import type { ActionResult } from "@/app/_actions/types";
import { copy } from "@/lib/copy";
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
  });

  if (error) {
    console.error("[submitGameScore]", error);
    return { ok: false, error: copy.games.submitError };
  }

  revalidatePath(`/app/rooms/${parsed.data.roomId}/games`);
  revalidatePath(`/app/rooms/${parsed.data.roomId}/games/${parsed.data.gameKey}`);
  return { ok: true };
}
