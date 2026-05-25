import { createClient } from "@/lib/supabase/server";
import type { ProposalComment } from "@/types/database";

/** All comments in a room (across its proposals), oldest first. */
export async function getRoomComments(
  roomId: string,
): Promise<ProposalComment[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("proposal_comments")
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: true });
  return data ?? [];
}
