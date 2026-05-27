"use client";

import { useEffect, useRef } from "react";

import type { RouletteTable } from "@/lib/roulette/table";
import { createClient } from "@/lib/supabase/client";

/** Subscribes to the room's shared roulette state and patches on every change. */
export function useRouletteRealtime(
  roomId: string,
  onState: (state: RouletteTable) => void,
) {
  const ref = useRef(onState);
  useEffect(() => {
    ref.current = onState;
  });

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`room:${roomId}:roulette:${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "roulette_tables",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const row = payload.new as { state?: RouletteTable };
          if (row?.state) ref.current(row.state);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [roomId]);
}
