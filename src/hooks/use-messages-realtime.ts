"use client";

import { useEffect, useRef } from "react";

import { createClient } from "@/lib/supabase/client";
import type { Message } from "@/types/database";

export interface MessagesRealtimeHandlers {
  onInsert: (message: Message) => void;
  onUpdate?: (message: Message) => void;
  onDelete?: (id: string) => void;
}

/** Subscribes to message inserts, edits and deletes in a room. */
export function useMessagesRealtime(
  roomId: string,
  handlers: MessagesRealtimeHandlers,
) {
  const ref = useRef(handlers);
  useEffect(() => {
    ref.current = handlers;
  });

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      // Unique topic per effect run (see proposals hook) to survive Strict Mode.
      .channel(`room:${roomId}:messages:${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => ref.current.onInsert(payload.new as Message),
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => ref.current.onUpdate?.(payload.new as Message),
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "messages",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const old = payload.old as { id?: string };
          if (old?.id) ref.current.onDelete?.(old.id);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [roomId]);
}
