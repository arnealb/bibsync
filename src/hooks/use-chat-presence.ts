"use client";

import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/client";

interface PresenceMeta {
  userId: string;
  name: string;
  typing: boolean;
}

export interface ChatPresence {
  /** User ids currently connected to the room's chat. */
  online: Set<string>;
  /** Others (not you) currently typing. */
  typing: { userId: string; name: string }[];
  /** Mark yourself as typing; auto-clears after a short idle. */
  setTyping: () => void;
}

/** How long after the last keystroke you stop showing as "typing". */
const TYPING_IDLE_MS = 2500;

/**
 * Realtime Presence for a room's chat: who's online and who's typing. Uses a
 * stable channel topic (every client must share it to see each other) keyed by
 * the user id, on the singleton authed socket.
 */
export function useChatPresence(
  roomId: string,
  userId: string,
  name: string,
): ChatPresence {
  const [online, setOnline] = useState<Set<string>>(new Set());
  const [typing, setTyping] = useState<{ userId: string; name: string }[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const idleTimer = useRef<number | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`room:${roomId}:online`, {
      config: { presence: { key: userId } },
    });
    channelRef.current = channel;

    const sync = () => {
      const state = channel.presenceState<PresenceMeta>();
      const nextOnline = new Set<string>();
      const nextTyping: { userId: string; name: string }[] = [];
      for (const key of Object.keys(state)) {
        const meta = state[key][state[key].length - 1];
        if (!meta) continue;
        nextOnline.add(meta.userId);
        if (meta.typing && meta.userId !== userId) {
          nextTyping.push({ userId: meta.userId, name: meta.name });
        }
      }
      setOnline(nextOnline);
      setTyping(nextTyping);
    };

    channel.on("presence", { event: "sync" }, sync).subscribe((status) => {
      if (status === "SUBSCRIBED") {
        void channel.track({ userId, name, typing: false });
      }
    });

    return () => {
      if (idleTimer.current) window.clearTimeout(idleTimer.current);
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [roomId, userId, name]);

  function markTyping() {
    const channel = channelRef.current;
    if (!channel) return;
    void channel.track({ userId, name, typing: true });
    if (idleTimer.current) window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => {
      void channel.track({ userId, name, typing: false });
    }, TYPING_IDLE_MS);
  }

  return { online, typing, setTyping: markTyping };
}
