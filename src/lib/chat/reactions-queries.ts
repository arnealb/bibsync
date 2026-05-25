import { createClient } from "@/lib/supabase/server";
import type { MessageReaction } from "@/types/database";

/** All emoji reactions for a room's messages. */
export async function getRoomReactions(
  roomId: string,
): Promise<MessageReaction[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("message_reactions")
    .select("*")
    .eq("room_id", roomId);
  return data ?? [];
}
