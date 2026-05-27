"use client";

import { useEffect, useRef, useState } from "react";

import { useMessagesRealtime } from "@/hooks/use-messages-realtime";
import { markChatRead, onChatRead, readChatLastSeen } from "@/lib/chat/unread";
import { createClient } from "@/lib/supabase/client";

/**
 * Number of unread chat messages for a room, surfaced as the chat-tab badge.
 *
 * Lives in the always-mounted room tabs so it keeps counting while the user is
 * on any other tab. On mount it counts the messages that arrived since the
 * stored read marker (excluding the user's own); realtime inserts then bump it
 * live. The chat page calls {@link markChatRead}, which resets the badge to
 * zero through the {@link onChatRead} subscription.
 */
export function useUnreadChat(
  roomId: string,
  userId: string,
  isOnChat: boolean,
): number {
  const [unread, setUnread] = useState(0);

  const isOnChatRef = useRef(isOnChat);
  useEffect(() => {
    isOnChatRef.current = isOnChat;
  });

  // Reset whenever the chat marks itself read (opened / new message seen).
  useEffect(() => onChatRead((read) => read === roomId && setUnread(0)), [
    roomId,
  ]);

  // Initial count: messages since the stored marker, minus the user's own.
  useEffect(() => {
    if (isOnChatRef.current || !readChatLastSeen(roomId)) {
      // On the chat tab, or first visit on this device: start from zero.
      markChatRead(roomId);
      return;
    }
    const since = readChatLastSeen(roomId);
    let cancelled = false;
    const supabase = createClient();
    void supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("room_id", roomId)
      .gt("created_at", since!)
      .neq("author_id", userId)
      .then(({ count }) => {
        if (!cancelled && typeof count === "number" && !isOnChatRef.current) {
          setUnread(count);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [roomId, userId]);

  // Live increments while away from the chat tab.
  useMessagesRealtime(roomId, (message) => {
    if (message.author_id === userId || isOnChatRef.current) return;
    setUnread((count) => count + 1);
  });

  return unread;
}
