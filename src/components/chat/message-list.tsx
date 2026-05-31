"use client";

import { useMemo, useState } from "react";
import { Check, Pencil, Trash2, X } from "lucide-react";

import { ChatImage } from "@/components/chat/chat-image";
import { MessageReactions } from "@/components/chat/message-reactions";
import { ProfileLink } from "@/components/profile/profile-link";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/user-avatar";
import { UserName } from "@/components/user-name";
import { isGifUrl } from "@/lib/chat/gif";
import { splitMentions } from "@/lib/chat/mentions";
import { copy } from "@/lib/copy";
import type { MemberMap } from "@/lib/members";
import type { MessageGroup } from "@/lib/messages/group";
import { formatMessageTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { MessageReaction } from "@/types/database";

export function MessageList({
  groups,
  members,
  userId,
  online,
  reactions,
  onToggleReaction,
  onEditMessage,
  onDeleteMessage,
}: {
  groups: MessageGroup[];
  members: MemberMap;
  userId: string;
  online?: Set<string>;
  reactions: MessageReaction[];
  onToggleReaction: (messageId: string, emoji: string) => void;
  onEditMessage: (messageId: string, content: string) => void;
  onDeleteMessage: (messageId: string) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const mentionNames = useMemo(
    () =>
      new Set(
        Object.values(members).map((m) => m.name.toLowerCase()),
      ),
    [members],
  );

  function startEdit(id: string, content: string) {
    setEditingId(id);
    setDraft(content);
  }

  function commitEdit() {
    const trimmed = draft.trim();
    if (editingId && trimmed) onEditMessage(editingId, trimmed);
    setEditingId(null);
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const name = members[group.authorId]?.name ?? "—";
        const isOwn = group.authorId === userId;
        return (
          <div key={group.key} className="flex gap-2.5">
            <ProfileLink
              userId={group.authorId}
              className="relative mt-0.5 shrink-0"
            >
              <UserAvatar
                name={name}
                avatarUrl={members[group.authorId]?.avatarUrl}
                className="size-7"
                fallbackClassName="text-[11px]"
                loadout={members[group.authorId]?.loadout}
              />
              {online?.has(group.authorId) && (
                <span className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-background bg-emerald-500" />
              )}
            </ProfileLink>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-medium">
                  <ProfileLink userId={group.authorId}>
                    <UserName
                      name={name}
                      loadout={members[group.authorId]?.loadout}
                    />
                  </ProfileLink>
                  {isOwn && (
                    <span className="text-muted-foreground">
                      {" "}
                      ({copy.rooms.you})
                    </span>
                  )}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatMessageTime(group.startedAt)}
                </span>
              </div>
              <div className="space-y-1.5">
                {group.items.map((message) => {
                  const editing = editingId === message.id;
                  const isImage = isGifUrl(message.content);
                  const canEdit = isOwn && !message.pending;
                  return (
                    <div key={message.id} className="group/msg">
                      {editing ? (
                        <div className="flex items-center gap-1.5">
                          <Input
                            autoFocus
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") commitEdit();
                              if (e.key === "Escape") setEditingId(null);
                            }}
                            className="h-8"
                          />
                          <button
                            type="button"
                            onClick={commitEdit}
                            aria-label={copy.chat.save}
                            className="text-emerald-500 hover:opacity-70"
                          >
                            <Check className="size-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            aria-label={copy.chat.cancel}
                            className="text-muted-foreground hover:opacity-70"
                          >
                            <X className="size-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-start gap-1.5">
                          <div className="min-w-0 flex-1">
                            {isImage ? (
                              <ChatImage
                                src={message.content}
                                pending={message.pending}
                              />
                            ) : (
                              <p
                                className={cn(
                                  "text-sm break-words whitespace-pre-wrap",
                                  message.pending &&
                                    "text-muted-foreground italic",
                                )}
                              >
                                {splitMentions(message.content, mentionNames).map(
                                  (part, i) =>
                                    part.mention ? (
                                      <span
                                        key={i}
                                        className="rounded bg-primary/15 px-0.5 font-medium text-primary"
                                      >
                                        {part.text}
                                      </span>
                                    ) : (
                                      <span key={i}>{part.text}</span>
                                    ),
                                )}
                                {message.edited_at && (
                                  <span className="ml-1 text-[10px] text-muted-foreground">
                                    ({copy.chat.edited})
                                  </span>
                                )}
                                {message.pending && ` · ${copy.chat.sending}`}
                              </p>
                            )}
                          </div>
                          {canEdit && (
                            <div className="flex shrink-0 items-center gap-1 opacity-0 transition group-hover/msg:opacity-100">
                              {!isImage && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    startEdit(message.id, message.content)
                                  }
                                  aria-label={copy.chat.edit}
                                  className="text-muted-foreground hover:text-foreground"
                                >
                                  <Pencil className="size-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => onDeleteMessage(message.id)}
                                aria-label={copy.chat.delete}
                                className="text-muted-foreground hover:text-red-500"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                      {!message.pending && !editing && (
                        <MessageReactions
                          messageId={message.id}
                          reactions={reactions.filter(
                            (r) => r.message_id === message.id,
                          )}
                          userId={userId}
                          onToggle={onToggleReaction}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
