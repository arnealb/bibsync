import { createClient } from "@/lib/supabase/server";

/** Ids of members currently in timeout in this room. */
export async function getRoomTimeouts(roomId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("room_timeouts")
    .select("user_id")
    .eq("room_id", roomId);

  if (error) {
    console.error("[getRoomTimeouts]", error);
    return [];
  }
  return (data ?? []).map((row) => row.user_id);
}
