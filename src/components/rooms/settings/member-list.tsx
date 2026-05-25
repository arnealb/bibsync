"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";

import { kickMember } from "@/app/_actions/rooms";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import { getInitials } from "@/lib/initials";

export interface MemberItem {
  userId: string;
  name: string;
  isOwner: boolean;
}

export function MemberList({
  roomId,
  members,
}: {
  roomId: string;
  members: MemberItem[];
}) {
  const [pending, startTransition] = useTransition();

  function onKick(userId: string) {
    startTransition(async () => {
      const result = await kickMember(roomId, userId);
      if (result.ok) toast.success(copy.rooms.settings.kicked);
      else toast.error(result.error);
    });
  }

  return (
    <ul className="divide-y">
      {members.map((member) => (
        <li
          key={member.userId}
          className="flex items-center justify-between gap-3 py-2.5"
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <Avatar className="size-8">
              <AvatarFallback className="text-xs">
                {getInitials(member.name)}
              </AvatarFallback>
            </Avatar>
            <span className="truncate text-sm">{member.name}</span>
            {member.isOwner && (
              <Badge variant="secondary">{copy.rooms.owner}</Badge>
            )}
          </div>
          {!member.isOwner && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={copy.rooms.settings.kick}
              disabled={pending}
              onClick={() => onKick(member.userId)}
            >
              <X />
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}
