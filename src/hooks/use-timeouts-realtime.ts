"use client";

import { useEffect, useRef } from "react";

import { createClient } from "@/lib/supabase/client";

export interface TimeoutsRealtimeHandlers {
  onInsert: (userId: string) => void;
  onDelete: (userId: string) => void;
}

/** Subscribes to timeout changes in a room. */
export function useTimeoutsRealtime(
  roomId: string,
  handlers: TimeoutsRealtimeHandlers,
) {
  const ref = useRef(handlers);
  useEffect(() => {
    ref.current = handlers;
  });

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`room:${roomId}:timeouts:${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "room_timeouts",
          filter: `room_id=eq.${roomId}`,
        },
        (p) => ref.current.onInsert((p.new as { user_id: string }).user_id),
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "room_timeouts",
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
