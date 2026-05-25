"use client";

import { useEffect, useRef } from "react";

import { createClient } from "@/lib/supabase/client";
import type { Presence } from "@/types/database";

export interface PresenceRealtimeHandlers {
  onUpsert: (presence: Presence) => void;
  onDelete: (key: { room_id: string; user_id: string }) => void;
}

/** Subscribes to presence changes for a room and forwards them to handlers. */
export function usePresenceRealtime(
  roomId: string,
  handlers: PresenceRealtimeHandlers,
) {
  const ref = useRef(handlers);
  useEffect(() => {
    ref.current = handlers;
  });

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`room:${roomId}:presence`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "presence",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            ref.current.onDelete(
              payload.old as { room_id: string; user_id: string },
            );
          } else {
            ref.current.onUpsert(payload.new as Presence);
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [roomId]);
}
