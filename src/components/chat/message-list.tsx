"use client";

import { UserAvatar } from "@/components/user-avatar";
import { isGifUrl } from "@/lib/chat/gif";
import { copy } from "@/lib/copy";
import type { MemberMap } from "@/lib/members";
import type { MessageGroup } from "@/lib/messages/group";
import { formatMessageTime } from "@/lib/time";
import { cn } from "@/lib/utils";

export function MessageList({
  groups,
  members,
  userId,
}: {
  groups: MessageGroup[];
  members: MemberMap;
  userId: string;
}) {
  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const name = members[group.authorId]?.name ?? "—";
        const isOwn = group.authorId === userId;
        return (
          <div key={group.key} className="flex gap-2.5">
            <UserAvatar
              name={name}
              avatarUrl={members[group.authorId]?.avatarUrl}
              className="mt-0.5 size-7 shrink-0"
              fallbackClassName="text-[11px]"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-medium">
                  {name}
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
              <div className="space-y-0.5">
                {group.items.map((message) =>
                  isGifUrl(message.content) ? (
                    <div
                      key={message.id}
                      className={cn(message.pending && "opacity-60")}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={message.content}
                        alt="GIF"
                        className="max-h-48 max-w-[220px] rounded-md"
                        loading="lazy"
                      />
                    </div>
                  ) : (
                    <p
                      key={message.id}
                      className={cn(
                        "text-sm break-words whitespace-pre-wrap",
                        message.pending && "text-muted-foreground italic",
                      )}
                    >
                      {message.content}
                      {message.pending && ` · ${copy.chat.sending}`}
                    </p>
                  ),
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
