"use client";

import { useEffect, useRef } from "react";

import type { RealtimeChannel } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/client";
import { ensureRealtimeAuth } from "@/lib/supabase/realtime-auth";

/**
 * Live wallet balance (and optional debt) for the signed-in user. The
 * `wallets` table is in the realtime publication and RLS-scoped to your own
 * row, so every server-side balance change (games, voting, hourly/daily claim,
 * shop) fires an event. The `debt` column rides along for free in the payload.
 *
 * The socket must carry the user's JWT *before* the channel joins, otherwise
 * the RLS-scoped `postgres_changes` binding is created anonymously and never
 * receives anything (see `ensureRealtimeAuth`). The header mounts this hook on
 * the very first cold load — the moment most likely to lose that race — so we
 * push the token and await it before subscribing.
 */
export function useBibcoinsRealtime(
  userId: string,
  onBalance: (bibcoins: number, debt?: number) => void,
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
            const row = p.new as { bibcoins?: number; debt?: number } | null;
            if (row && typeof row.bibcoins === "number")
              ref.current(
                row.bibcoins,
                typeof row.debt === "number" ? row.debt : undefined,
              );
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
