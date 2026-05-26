import { isProposalVisible } from "@/lib/proposals/visibility";
import { createClient } from "@/lib/supabase/server";
import { isoDatePlus } from "@/lib/time";
import type { BreakProposal, RoomPlace, Vote } from "@/types/database";

/** Reusable destination/walk presets saved for a room. */
export async function getRoomPlaces(roomId: string): Promise<RoomPlace[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("room_places")
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: true });
  return data ?? [];
}

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

  // Slot suggestions always stay; free-form proposals expire 1h after they end.
  const visible = (proposals ?? []).filter(
    (proposal) => proposal.slot_key || isProposalVisible(proposal),
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
