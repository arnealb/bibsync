"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/lib/initials";
import type { MessageGroup } from "@/lib/messages/group";
import { copy } from "@/lib/copy";
import { formatMessageTime } from "@/lib/time";
import { cn } from "@/lib/utils";

export function MessageList({
  groups,
  members,
  userId,
}: {
  groups: MessageGroup[];
  members: Record<string, string>;
  userId: string;
}) {
  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const name = members[group.authorId] ?? "—";
        const isOwn = group.authorId === userId;
        return (
          <div key={group.key} className="flex gap-2.5">
            <Avatar className="mt-0.5 size-7 shrink-0">
              <AvatarFallback className="text-[11px]">
                {getInitials(name)}
              </AvatarFallback>
            </Avatar>
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
                {group.items.map((message) => (
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
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
