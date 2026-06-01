"use client";

import { useEffect, useRef } from "react";

import { createClient } from "@/lib/supabase/client";
import { ensureRealtimeAuth } from "@/lib/supabase/realtime-auth";

export interface TheftRealtimeHandlers {
  onRobbed: (theft: { id: string; amount: number; createdAt: string }) => void;
  onResolved: (id: string) => void;
}

/** Notifies the victim when they're robbed, and when a theft is resolved. */
export function useTheftRealtime(
  userId: string,
  handlers: TheftRealtimeHandlers,
) {
  const ref = useRef(handlers);
  useEffect(() => {
    ref.current = handlers;
  });

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | undefined;

    void (async () => {
      await ensureRealtimeAuth(supabase);
      if (!active) return;
      channel = supabase
        .channel(`thefts:${userId}:${crypto.randomUUID()}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "thefts",
            filter: `victim_id=eq.${userId}`,
          },
          (p) => {
            const row = p.new as {
              id: string;
              amount: number;
              created_at: string;
            };
            ref.current.onRobbed({
              id: row.id,
              amount: row.amount,
              createdAt: row.created_at,
            });
          },
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "thefts",
            filter: `victim_id=eq.${userId}`,
          },
          (p) => {
            const row = p.new as { id: string; status: string };
            if (row.status !== "pending") ref.current.onResolved(row.id);
          },
        )
        .subscribe();
    })();

    return () => {
      active = false;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [userId]);
}
