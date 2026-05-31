"use client";

import { useEffect, useRef } from "react";

import { createClient } from "@/lib/supabase/client";
import type { FoodPlaceBet } from "@/types/database";

/** Subscribes to new food-place bets in a room. */
export function useFoodBetsRealtime(
  roomId: string,
  onInsert: (bet: FoodPlaceBet) => void,
) {
  const ref = useRef(onInsert);
  useEffect(() => {
    ref.current = onInsert;
  });

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`room:${roomId}:foodbets:${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "food_place_bets",
          filter: `room_id=eq.${roomId}`,
        },
        (p) => ref.current(p.new as FoodPlaceBet),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [roomId]);
}
