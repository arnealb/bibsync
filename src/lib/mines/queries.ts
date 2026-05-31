import type { MinesState } from "@/lib/mines/engine";
import { createClient } from "@/lib/supabase/server";

/**
 * The caller's current Mines game in a room (active or last finished one).
 * Uses the user-session client; RLS only returns the caller's own row. Returns
 * null when they have never played here.
 */
export async function getMinesGame(
  roomId: string,
  userId: string,
): Promise<MinesState | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mines_games")
    .select("state")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[getMinesGame]", error);
    return null;
  }
  if (!data) return null;

  const state = data.state as unknown as MinesState;
  return typeof state.status === "string" ? state : null;
}
