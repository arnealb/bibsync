"use client";

import { useEffect, useRef } from "react";

import { createClient } from "@/lib/supabase/client";
import type { ProposalComment } from "@/types/database";

export interface CommentsRealtimeHandlers {
  onInsert: (comment: ProposalComment) => void;
  onDelete: (id: string) => void;
}

/** Subscribes to proposal-comment changes in a room. */
export function useProposalCommentsRealtime(
  roomId: string,
  handlers: CommentsRealtimeHandlers,
) {
  const ref = useRef(handlers);
  useEffect(() => {
    ref.current = handlers;
  });

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`room:${roomId}:comments:${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "proposal_comments",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => ref.current.onInsert(payload.new as ProposalComment),
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "proposal_comments",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => ref.current.onDelete((payload.old as { id: string }).id),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [roomId]);
}
