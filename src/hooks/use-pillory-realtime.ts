"use client";

import { useEffect, useRef } from "react";

import { createClient } from "@/lib/supabase/client";

export interface PilloryRealtimeHandlers {
  onInsert: (entry: { userId: string; reason: string | null }) => void;
  onDelete: (userId: string) => void;
}

/** Subscribes to schandpaal changes in a room. */
export function usePilloryRealtime(
  roomId: string,
  handlers: PilloryRealtimeHandlers,
) {
  const ref = useRef(handlers);
  useEffect(() => {
    ref.current = handlers;
  });

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`room:${roomId}:pillory:${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "room_pillory",
          filter: `room_id=eq.${roomId}`,
        },
        (p) => {
          const row = p.new as { user_id: string; reason: string | null };
          ref.current.onInsert({ userId: row.user_id, reason: row.reason });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "room_pillory",
          filter: `room_id=eq.${roomId}`,
        },
        (p) => ref.current.onDelete((p.old as { user_id: string }).user_id),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [roomId]);
}
