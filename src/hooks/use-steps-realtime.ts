"use client";

import { useEffect, useRef } from "react";

import { createClient } from "@/lib/supabase/client";

export interface StepSessionEvent {
  user_id: string;
  steps: number;
  recorded_for: string;
}

/** Subscribes to new step sessions in a room (for a live leaderboard). */
export function useStepsRealtime(
  roomId: string,
  onInsert: (row: StepSessionEvent) => void,
) {
  const ref = useRef(onInsert);
  useEffect(() => {
    ref.current = onInsert;
  });

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`room:${roomId}:steps:${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "step_sessions",
          filter: `room_id=eq.${roomId}`,
        },
        (p) => ref.current(p.new as StepSessionEvent),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [roomId]);
}
