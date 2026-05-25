import { createClient } from "@/lib/supabase/server";
import { todayInBrussels } from "@/lib/time";
import type { BreakProposal, Vote } from "@/types/database";

export interface RoomProposalsData {
  proposals: BreakProposal[];
  votes: Vote[];
}

/**
 * Proposals for a room from today onwards, plus all their votes. The realtime
 * client patches further changes on top of this snapshot.
 */
export async function getRoomProposals(
  roomId: string,
): Promise<RoomProposalsData> {
  const supabase = await createClient();

  const { data: proposals } = await supabase
    .from("break_proposals")
    .select("*")
    .eq("room_id", roomId)
    .gte("proposal_date", todayInBrussels())
    .order("proposal_date", { ascending: true })
    .order("start_time", { ascending: true });

  if (!proposals || proposals.length === 0) {
    return { proposals: [], votes: [] };
  }

  const { data: votes } = await supabase
    .from("votes")
    .select("*")
    .in(
      "proposal_id",
      proposals.map((proposal) => proposal.id),
    );

  return { proposals, votes: votes ?? [] };
}
