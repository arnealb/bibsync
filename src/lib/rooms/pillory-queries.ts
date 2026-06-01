import { createClient } from "@/lib/supabase/server";

export interface PilloryEntry {
  userId: string;
  reason: string | null;
  /** ISO timestamp the member was put on the schandpaal. */
  createdAt: string;
}

/** Who's on the room's schandpaal (and why). Member-scoped by RLS. */
export async function getRoomPillory(roomId: string): Promise<PilloryEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("room_pillory")
    .select("user_id, reason, created_at")
    .eq("room_id", roomId);

  if (error) {
    console.error("[getRoomPillory]", error);
    return [];
  }
  return (data ?? []).map((r) => ({
    userId: r.user_id,
    reason: r.reason,
    createdAt: r.created_at,
  }));
}

/** True when a member is currently on the room's schandpaal. */
export async function isOnPillory(
  roomId: string,
  userId: string,
): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("room_pillory")
    .select("user_id")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[isOnPillory]", error);
    return false;
  }
  return data != null;
}
