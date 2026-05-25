import { createClient } from "@/lib/supabase/server";
import { isoDatePlus } from "@/lib/time";
import type { FoodComment, FoodProposal, FoodVote } from "@/types/database";

export interface RoomFoodData {
  proposals: FoodProposal[];
  votes: FoodVote[];
  comments: FoodComment[];
}

/** Food proposals (from yesterday onwards) for a room, with votes + comments. */
export async function getRoomFood(roomId: string): Promise<RoomFoodData> {
  const supabase = await createClient();
  const { data: proposals } = await supabase
    .from("food_proposals")
    .select("*")
    .eq("room_id", roomId)
    .gte("food_date", isoDatePlus(-1))
    .order("food_date", { ascending: true })
    .order("created_at", { ascending: true });

  const list = proposals ?? [];
  if (list.length === 0) return { proposals: [], votes: [], comments: [] };

  const ids = list.map((proposal) => proposal.id);
  const [votesResult, commentsResult] = await Promise.all([
    supabase.from("food_votes").select("*").in("food_proposal_id", ids),
    supabase
      .from("food_comments")
      .select("*")
      .eq("room_id", roomId)
      .order("created_at", { ascending: true }),
  ]);

  return {
    proposals: list,
    votes: votesResult.data ?? [],
    comments: commentsResult.data ?? [],
  };
}
