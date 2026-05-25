"use client";

import { useEffect, useRef } from "react";

import type { PublicState } from "@/lib/poker/engine";
import { createClient } from "@/lib/supabase/client";

/** Subscribes to the room's public poker state and patches on every change. */
export function usePokerRealtime(
  roomId: string,
  onState: (state: PublicState) => void,
) {
  const ref = useRef(onState);
  useEffect(() => {
    ref.current = onState;
  });

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`room:${roomId}:poker:${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "poker_tables",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const row = payload.new as { state?: PublicState };
          if (row?.state) ref.current(row.state);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [roomId]);
}
