"use client";

import { useEffect, useRef } from "react";

import type { LotteryState } from "@/lib/lottery/engine";
import { createClient } from "@/lib/supabase/client";

/** Subscribes to a room's lottery round and forwards each new public state. */
export function useLotteryRealtime(
  roomId: string,
  onState: (state: LotteryState) => void,
) {
  const ref = useRef(onState);
  useEffect(() => {
    ref.current = onState;
  });

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`room:${roomId}:lottery:${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "lottery_rounds",
          filter: `room_id=eq.${roomId}`,
        },
        (p) => {
          const row = p.new as { state?: LotteryState };
          if (row?.state) ref.current(row.state);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [roomId]);
}
