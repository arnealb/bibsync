"use client";

import { useEffect, useRef } from "react";

import type { PublicTable } from "@/lib/blackjack/table";
import { createClient } from "@/lib/supabase/client";

/** Subscribes to the room's public blackjack state and patches on every change. */
export function useBlackjackRealtime(
  roomId: string,
  onState: (state: PublicTable) => void,
) {
  const ref = useRef(onState);
  useEffect(() => {
    ref.current = onState;
  });

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`room:${roomId}:blackjack:${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "blackjack_tables",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const row = payload.new as { state?: PublicTable };
          if (row?.state) ref.current(row.state);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [roomId]);
}
