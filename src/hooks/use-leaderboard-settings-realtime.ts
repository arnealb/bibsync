"use client";

import { useEffect, useRef } from "react";

import { createClient } from "@/lib/supabase/client";

/** Subscribes to the room's shared leaderboard setting (show-cheated toggle). */
export function useLeaderboardSettingsRealtime(
  roomId: string,
  onChange: (showCheated: boolean) => void,
) {
  const ref = useRef(onChange);
  useEffect(() => {
    ref.current = onChange;
  });

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`room:${roomId}:leaderboard:${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_leaderboard_settings",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const row = payload.new as { show_cheated?: boolean };
          if (typeof row?.show_cheated === "boolean") ref.current(row.show_cheated);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [roomId]);
}
