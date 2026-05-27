import { isPresent, presenceVerdict } from "@/lib/presence/present";
import { createClient } from "@/lib/supabase/server";
import { todayInBrussels } from "@/lib/time";
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

/**
 * Whether the user counts as present in the room right now — location-confirmed
 * OR checked in today. Used to gate proposing/voting/commenting on breaks.
 */
export async function isUserPresent(
  roomId: string,
  userId: string,
): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("presence")
    .select("at_location, location_checked_at, checked_in_on")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .maybeSingle();
  return isPresent(presenceVerdict(data ?? undefined, todayInBrussels()));
}
