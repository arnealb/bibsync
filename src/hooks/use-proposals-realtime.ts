"use client";

import { useEffect, useRef } from "react";

import { createClient } from "@/lib/supabase/client";
import type { BreakProposal, Vote } from "@/types/database";

export interface ProposalsRealtimeHandlers {
  onProposalInsert: (proposal: BreakProposal) => void;
  onProposalUpdate: (proposal: BreakProposal) => void;
  onProposalDelete: (id: string) => void;
  onVoteUpsert: (vote: Vote) => void;
  onVoteDelete: (key: { proposal_id: string; user_id: string }) => void;
}

/**
 * Subscribes to break_proposals (filtered by room) and votes (filtered by RLS
 * to the user's accessible proposals) and forwards changes to the handlers.
 * Handlers are read via a ref so the subscription isn't torn down each render.
 */
export function useProposalsRealtime(
  roomId: string,
  handlers: ProposalsRealtimeHandlers,
) {
  const ref = useRef(handlers);
  useEffect(() => {
    ref.current = handlers;
  });

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`room:${roomId}:proposals`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "break_proposals",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => ref.current.onProposalInsert(payload.new as BreakProposal),
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "break_proposals",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => ref.current.onProposalUpdate(payload.new as BreakProposal),
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "break_proposals",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) =>
          ref.current.onProposalDelete((payload.old as { id: string }).id),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "votes" },
        (payload) => ref.current.onVoteUpsert(payload.new as Vote),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "votes" },
        (payload) => ref.current.onVoteUpsert(payload.new as Vote),
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "votes" },
        (payload) =>
          ref.current.onVoteDelete(
            payload.old as { proposal_id: string; user_id: string },
          ),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [roomId]);
}
