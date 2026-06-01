import type { HiloState } from "@/lib/hilo/engine";
import { createClient } from "@/lib/supabase/server";

/** The caller's current Hi-Lo game in a room (or last finished one). */
export async function getHiloGame(
  roomId: string,
  userId: string,
): Promise<HiloState | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("hilo_games")
    .select("state")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[getHiloGame]", error);
    return null;
  }
  if (!data) return null;
  const state = data.state as unknown as HiloState;
  return typeof state.status === "string" ? state : null;
}
