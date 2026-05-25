import { createClient } from "@/lib/supabase/server";
import type { Presence } from "@/types/database";

/** All presence rows for a room (the realtime client patches changes on top). */
export async function getRoomPresence(roomId: string): Promise<Presence[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("presence")
    .select("*")
    .eq("room_id", roomId);
  return data ?? [];
}
