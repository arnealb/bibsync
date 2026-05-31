"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";

import { kickMember } from "@/app/_actions/rooms";
import { ProfileLink } from "@/components/profile/profile-link";
import { UserAvatar } from "@/components/user-avatar";
import { UserName } from "@/components/user-name";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import type { ResolvedLoadout } from "@/lib/cosmetics/resolve";

export interface MemberItem {
  userId: string;
  name: string;
  avatarUrl: string | null;
  loadout: ResolvedLoadout | null;
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
          <ProfileLink
            userId={member.userId}
            className="flex min-w-0 items-center gap-2.5"
          >
            <UserAvatar
              name={member.name}
              avatarUrl={member.avatarUrl}
              className="size-8"
              fallbackClassName="text-xs"
              loadout={member.loadout}
            />
            <span className="truncate text-sm">
              <UserName name={member.name} loadout={member.loadout} />
            </span>
            {member.isOwner && (
              <Badge variant="secondary">{copy.rooms.owner}</Badge>
            )}
          </ProfileLink>
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
