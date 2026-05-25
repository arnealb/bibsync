"use client";

import { useEffect, useRef } from "react";

import { createClient } from "@/lib/supabase/client";
import type { Message } from "@/types/database";

/** Subscribes to new messages in a room and forwards inserts to the handler. */
export function useMessagesRealtime(
  roomId: string,
  onInsert: (message: Message) => void,
) {
  const ref = useRef(onInsert);
  useEffect(() => {
    ref.current = onInsert;
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
        (payload) => ref.current(payload.new as Message),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [roomId]);
}
