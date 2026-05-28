"use client";

import { ChatImage } from "@/components/chat/chat-image";
import { MessageReactions } from "@/components/chat/message-reactions";
import { ProfileLink } from "@/components/profile/profile-link";
import { UserAvatar } from "@/components/user-avatar";
import { isGifUrl } from "@/lib/chat/gif";
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
  reactions,
  onToggleReaction,
}: {
  groups: MessageGroup[];
  members: MemberMap;
  userId: string;
  reactions: MessageReaction[];
  onToggleReaction: (messageId: string, emoji: string) => void;
}) {
  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const name = members[group.authorId]?.name ?? "—";
        const isOwn = group.authorId === userId;
        return (
          <div key={group.key} className="flex gap-2.5">
            <ProfileLink userId={group.authorId} className="mt-0.5 shrink-0">
              <UserAvatar
                name={name}
                avatarUrl={members[group.authorId]?.avatarUrl}
                className="size-7"
                fallbackClassName="text-[11px]"
              />
            </ProfileLink>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-medium">
                  <ProfileLink userId={group.authorId}>{name}</ProfileLink>
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
                {group.items.map((message) => (
                  <div key={message.id}>
                    {isGifUrl(message.content) ? (
                      <ChatImage
                        src={message.content}
                        pending={message.pending}
                      />
                    ) : (
                      <p
                        className={cn(
                          "text-sm break-words whitespace-pre-wrap",
                          message.pending && "text-muted-foreground italic",
                        )}
                      >
                        {message.content}
                        {message.pending && ` · ${copy.chat.sending}`}
                      </p>
                    )}
                    {!message.pending && (
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
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
