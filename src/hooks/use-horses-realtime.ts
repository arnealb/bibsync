"use client";

import { useEffect, useRef } from "react";

import { createClient } from "@/lib/supabase/client";

/**
 * Signals on any horse-race change (a race opening/resolving, a bet landing).
 * Both tables are global and authenticated-readable, so no filter is needed;
 * the callback should refetch the racebook snapshot rather than patch rows.
 */
export function useHorsesRealtime(onChange: () => void) {
  const ref = useRef(onChange);
  useEffect(() => {
    ref.current = onChange;
  });

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`horses:${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "horse_races" },
        () => ref.current(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "horse_race_bets" },
        () => ref.current(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);
}
