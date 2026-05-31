"use client";

import { useEffect, useRef } from "react";

import { createClient } from "@/lib/supabase/client";

/**
 * Live wallet balance for the signed-in user. The `wallets` table is in the
 * realtime publication and RLS-scoped to your own row, so every server-side
 * balance change (games, voting, hourly/daily claim, shop) fires an event.
 */
export function useBibcoinsRealtime(
  userId: string,
  onBalance: (bibcoins: number) => void,
) {
  const ref = useRef(onBalance);
  useEffect(() => {
    ref.current = onBalance;
  });

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`wallet:${userId}:${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "wallets",
          filter: `user_id=eq.${userId}`,
        },
        (p) => {
          const row = p.new as { bibcoins?: number } | null;
          if (row && typeof row.bibcoins === "number") ref.current(row.bibcoins);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);
}
