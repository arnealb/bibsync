"use client";

import { useEffect, useRef } from "react";

import type { RealtimeChannel } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/client";
import { ensureRealtimeAuth } from "@/lib/supabase/realtime-auth";

/**
 * Live wallet balance for the signed-in user. The `wallets` table is in the
 * realtime publication and RLS-scoped to your own row, so every server-side
 * balance change (games, voting, hourly/daily claim, shop) fires an event.
 *
 * The socket must carry the user's JWT *before* the channel joins, otherwise
 * the RLS-scoped `postgres_changes` binding is created anonymously and never
 * receives anything (see `ensureRealtimeAuth`). The header mounts this hook on
 * the very first cold load — the moment most likely to lose that race — so we
 * push the token and await it before subscribing.
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
    let channel: RealtimeChannel | undefined;
    let active = true;

    void (async () => {
      await ensureRealtimeAuth(supabase);
      if (!active) return; // unmounted while authing — don't open a channel
      channel = supabase
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
            if (row && typeof row.bibcoins === "number")
              ref.current(row.bibcoins);
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
