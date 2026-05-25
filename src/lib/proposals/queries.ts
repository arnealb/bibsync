import { isProposalVisible } from "@/lib/proposals/visibility";
import { createClient } from "@/lib/supabase/server";
import { isoDatePlus } from "@/lib/time";
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
    // From yesterday so late-night proposals crossing midnight aren't dropped;
    // the precise "hide one hour after it ends" rule is applied below.
    .gte("proposal_date", isoDatePlus(-1))
    .eq("room_id", roomId)
    .order("proposal_date", { ascending: true })
    .order("start_time", { ascending: true });

  const visible = (proposals ?? []).filter((proposal) =>
    isProposalVisible(proposal),
  );
  if (visible.length === 0) return { proposals: [], votes: [] };

  const { data: votes } = await supabase
    .from("votes")
    .select("*")
    .in(
      "proposal_id",
      visible.map((proposal) => proposal.id),
    );

  return { proposals: visible, votes: votes ?? [] };
}
