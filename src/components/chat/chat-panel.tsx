"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { loadOlderMessages, sendMessage } from "@/app/_actions/messages";
import { ChatInput } from "@/components/chat/chat-input";
import { MessageList } from "@/components/chat/message-list";
import { Button } from "@/components/ui/button";
import { useMessagesRealtime } from "@/hooks/use-messages-realtime";
import { copy } from "@/lib/copy";
import { groupMessages, type ChatMessage } from "@/lib/messages/group";

const NEAR_BOTTOM_PX = 100;

interface ChatPanelProps {
  roomId: string;
  userId: string;
  members: Record<string, string>;
  initialMessages: ChatMessage[];
  initialHasMore: boolean;
}

export function ChatPanel({
  roomId,
  userId,
  members,
  initialMessages,
  initialHasMore,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [newCount, setNewCount] = useState(0);
  const [sending, startSending] = useTransition();
  const [loadingMore, startLoadingMore] = useTransition();

  const scrollRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const pendingScrollRef = useRef(true);
  const restoreHeightRef = useRef<number | null>(null);

  function scrollToBottom() {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (restoreHeightRef.current != null) {
      el.scrollTop = el.scrollHeight - restoreHeightRef.current;
      restoreHeightRef.current = null;
    } else if (pendingScrollRef.current) {
      scrollToBottom();
      pendingScrollRef.current = false;
      setNewCount(0);
    }
  }, [messages]);

  useMessagesRealtime(roomId, (incoming) => {
    setMessages((prev) =>
      prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming],
    );
    if (incoming.author_id === userId || atBottomRef.current) {
      pendingScrollRef.current = true;
    } else {
      setNewCount((count) => count + 1);
    }
  });

  function handleSend(content: string) {
    const tempId = `temp-${crypto.randomUUID()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        room_id: roomId,
        author_id: userId,
        content,
        created_at: new Date().toISOString(),
        pending: true,
      },
    ]);
    pendingScrollRef.current = true;
    startSending(async () => {
      const result = await sendMessage({ roomId, content });
      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => m.id !== tempId);
        if (!result.ok) return withoutTemp;
        return withoutTemp.some((m) => m.id === result.message.id)
          ? withoutTemp
          : [...withoutTemp, result.message];
      });
      if (!result.ok) toast.error(result.error);
    });
  }

  function handleLoadMore() {
    const oldest = messages[0];
    if (!oldest) return;
    restoreHeightRef.current = scrollRef.current?.scrollHeight ?? null;
    startLoadingMore(async () => {
      const result = await loadOlderMessages(roomId, oldest.created_at);
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        return [
          ...result.messages.filter((m) => !seen.has(m.id)),
          ...prev,
        ];
      });
      setHasMore(result.hasMore);
    });
  }

  const groups = groupMessages(messages);

  return (
    <div className="relative flex h-[60vh] flex-col rounded-lg border lg:h-[460px]">
      <div
        ref={scrollRef}
        onScroll={() => {
          const el = scrollRef.current;
          atBottomRef.current = el
            ? el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX
            : true;
          if (atBottomRef.current) setNewCount(0);
        }}
        className="flex-1 overflow-y-auto p-3"
      >
        {hasMore && (
          <div className="mb-3 flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLoadMore}
              disabled={loadingMore}
            >
              {copy.chat.loadMore}
            </Button>
          </div>
        )}
        {messages.length === 0 ? (
          <p className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
            {copy.chat.empty}
          </p>
        ) : (
          <MessageList groups={groups} members={members} userId={userId} />
        )}
      </div>

      {newCount > 0 && (
        <button
          type="button"
          onClick={() => {
            scrollToBottom();
            setNewCount(0);
          }}
          className="absolute bottom-16 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground shadow-md"
        >
          {copy.chat.newMessages(newCount)}
        </button>
      )}

      <ChatInput onSend={handleSend} pending={sending} />
    </div>
  );
}
