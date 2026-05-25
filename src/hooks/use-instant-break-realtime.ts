"use client";

import { useEffect, useRef } from "react";

import { createClient } from "@/lib/supabase/client";
import type { InstantBreak, InstantBreakPush } from "@/types/database";

export interface InstantBreakRealtimeHandlers {
  onBreak: (breakRow: InstantBreak) => void;
  onPush: (push: InstantBreakPush) => void;
}

/** Subscribes to instant-break declarations and presses in a room. */
export function useInstantBreakRealtime(
  roomId: string,
  handlers: InstantBreakRealtimeHandlers,
) {
  const ref = useRef(handlers);
  useEffect(() => {
    ref.current = handlers;
  });

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`room:${roomId}:instant-break:${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "instant_breaks",
          filter: `room_id=eq.${roomId}`,
        },
        (p) => ref.current.onBreak(p.new as InstantBreak),
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "instant_break_pushes",
          filter: `room_id=eq.${roomId}`,
        },
        (p) => ref.current.onPush(p.new as InstantBreakPush),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [roomId]);
}
