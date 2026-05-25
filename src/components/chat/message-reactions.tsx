"use client";

import { useState } from "react";
import { SmilePlus } from "lucide-react";

import { REACTION_EMOJIS } from "@/lib/chat/reactions";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/utils";
import type { MessageReaction } from "@/types/database";

interface MessageReactionsProps {
  messageId: string;
  reactions: MessageReaction[];
  userId: string;
  onToggle: (messageId: string, emoji: string) => void;
}

export function MessageReactions({
  messageId,
  reactions,
  userId,
  onToggle,
}: MessageReactionsProps) {
  const [open, setOpen] = useState(false);

  const byEmoji = new Map<string, { count: number; mine: boolean }>();
  for (const reaction of reactions) {
    const current = byEmoji.get(reaction.emoji) ?? { count: 0, mine: false };
    current.count += 1;
    if (reaction.user_id === userId) current.mine = true;
    byEmoji.set(reaction.emoji, current);
  }

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      {[...byEmoji.entries()].map(([emoji, { count, mine }]) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onToggle(messageId, emoji)}
          className={cn(
            "rounded-full border px-1.5 py-0.5 text-xs tabular-nums",
            mine
              ? "border-primary/40 bg-primary/10"
              : "border-border bg-muted/50 hover:bg-muted",
          )}
        >
          {emoji} {count}
        </button>
      ))}

      <div className="relative">
        <button
          type="button"
          aria-label={copy.chat.react}
          onClick={() => setOpen((o) => !o)}
          className="rounded-full border border-transparent px-1 py-0.5 text-muted-foreground hover:border-border hover:bg-muted"
        >
          <SmilePlus className="size-3.5" />
        </button>
        {open && (
          <div className="absolute bottom-full z-10 mb-1 flex gap-0.5 rounded-md border bg-popover p-1 shadow-md">
            {REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  onToggle(messageId, emoji);
                  setOpen(false);
                }}
                className="rounded px-1 text-base hover:bg-accent"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
