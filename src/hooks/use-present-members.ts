"use client";

import { useEffect, useMemo, useState } from "react";

import { usePresenceRealtime } from "@/hooks/use-presence-realtime";
import { locationStatus } from "@/lib/presence/location";
import type { Presence } from "@/types/database";

/** Module-scope clock read so render stays pure (no Date.now in render). */
function nowMs(): number {
  return Date.now();
}

/**
 * Set of user IDs currently confirmed present at the room (fresh location
 * verdict "here"). Keeps its own presence subscription + clock so it stays
 * live on the proposals panel without coupling to the presence sidebar.
 */
export function usePresentMembers(
  roomId: string,
  initial: Presence[],
): Set<string> {
  const [presence, setPresence] = useState<Record<string, Presence>>(() =>
    Object.fromEntries(initial.map((row) => [row.user_id, row])),
  );
  const [clock, setClock] = useState(0);

  useEffect(() => {
    const tick = () => setClock(nowMs());
    const first = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, 60_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, []);

  usePresenceRealtime(roomId, {
    onUpsert: (row) => setPresence((prev) => ({ ...prev, [row.user_id]: row })),
    onDelete: (key) =>
      setPresence((prev) => {
        const next = { ...prev };
        delete next[key.user_id];
        return next;
      }),
  });

  return useMemo(() => {
    const ids = new Set<string>();
    if (clock === 0) return ids;
    for (const [userId, row] of Object.entries(presence)) {
      if (locationStatus(row, clock) === "here") ids.add(userId);
    }
    return ids;
  }, [presence, clock]);
}
