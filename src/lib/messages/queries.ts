import { createClient } from "@/lib/supabase/server";
import { MESSAGE_PAGE_SIZE } from "@/lib/validation/messages";
import type { Message } from "@/types/database";

export interface RoomMessagesData {
  messages: Message[];
  hasMore: boolean;
}

/** The most recent page of messages for a room, oldest-first for display. */
export async function getRoomMessages(
  roomId: string,
): Promise<RoomMessagesData> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("messages")
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(MESSAGE_PAGE_SIZE);

  const rows = data ?? [];
  return {
    messages: [...rows].reverse(),
    hasMore: rows.length === MESSAGE_PAGE_SIZE,
  };
}
