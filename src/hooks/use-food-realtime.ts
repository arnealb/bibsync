"use client";

import { useEffect, useRef } from "react";

import { createClient } from "@/lib/supabase/client";
import type { FoodComment, FoodProposal, FoodVote } from "@/types/database";

export interface FoodRealtimeHandlers {
  onProposalInsert: (proposal: FoodProposal) => void;
  onProposalUpdate: (proposal: FoodProposal) => void;
  onProposalDelete: (id: string) => void;
  onVoteUpsert: (vote: FoodVote) => void;
  onVoteDelete: (key: { food_proposal_id: string; user_id: string }) => void;
  onCommentInsert: (comment: FoodComment) => void;
  onCommentDelete: (id: string) => void;
}

/** One channel covering food proposals, votes and comments for a room. */
export function useFoodRealtime(
  roomId: string,
  handlers: FoodRealtimeHandlers,
) {
  const ref = useRef(handlers);
  useEffect(() => {
    ref.current = handlers;
  });

  useEffect(() => {
    const supabase = createClient();
    const roomFilter = { schema: "public", filter: `room_id=eq.${roomId}` };
    const channel = supabase
      .channel(`room:${roomId}:food:${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "INSERT", table: "food_proposals", ...roomFilter },
        (p) => ref.current.onProposalInsert(p.new as FoodProposal),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", table: "food_proposals", ...roomFilter },
        (p) => ref.current.onProposalUpdate(p.new as FoodProposal),
      )
      .on(
        "postgres_changes",
        { event: "DELETE", table: "food_proposals", ...roomFilter },
        (p) => ref.current.onProposalDelete((p.old as { id: string }).id),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "food_votes" },
        (p) => ref.current.onVoteUpsert(p.new as FoodVote),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "food_votes" },
        (p) => ref.current.onVoteUpsert(p.new as FoodVote),
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "food_votes" },
        (p) =>
          ref.current.onVoteDelete(
            p.old as { food_proposal_id: string; user_id: string },
          ),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", table: "food_comments", ...roomFilter },
        (p) => ref.current.onCommentInsert(p.new as FoodComment),
      )
      .on(
        "postgres_changes",
        { event: "DELETE", table: "food_comments", ...roomFilter },
        (p) => ref.current.onCommentDelete((p.old as { id: string }).id),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [roomId]);
}
