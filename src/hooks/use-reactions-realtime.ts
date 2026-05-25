"use client";

import { useEffect, useRef } from "react";

import { createClient } from "@/lib/supabase/client";
import type { MessageReaction } from "@/types/database";

export interface ReactionsRealtimeHandlers {
  onInsert: (reaction: MessageReaction) => void;
  onDelete: (key: {
    message_id: string;
    user_id: string;
    emoji: string;
  }) => void;
}

/** Subscribes to message-reaction changes in a room. */
export function useReactionsRealtime(
  roomId: string,
  handlers: ReactionsRealtimeHandlers,
) {
  const ref = useRef(handlers);
  useEffect(() => {
    ref.current = handlers;
  });

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`room:${roomId}:reactions:${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "message_reactions",
          filter: `room_id=eq.${roomId}`,
        },
        (p) => ref.current.onInsert(p.new as MessageReaction),
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "message_reactions",
          filter: `room_id=eq.${roomId}`,
        },
        (p) =>
          ref.current.onDelete(
            p.old as { message_id: string; user_id: string; emoji: string },
          ),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [roomId]);
}
