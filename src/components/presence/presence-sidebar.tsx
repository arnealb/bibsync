"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { setPresence } from "@/app/_actions/presence";
import { StatusControl } from "@/components/presence/status-control";
import { UserAvatar } from "@/components/user-avatar";
import { usePresenceRealtime } from "@/hooks/use-presence-realtime";
import type { ResolvedLoadout } from "@/lib/cosmetics/resolve";
import { copy } from "@/lib/copy";
import { PRESENCE_EMOJI } from "@/lib/presence/display";
import { presenceSortKey, presenceView } from "@/lib/presence/view";
import { formatTime } from "@/lib/time";
import type { PresenceStatus, Presence } from "@/types/database";

interface RoomMemberOption {
  id: string;
  name: string;
  avatarUrl: string | null;
  loadout?: ResolvedLoadout | null;
}

interface PresenceSidebarProps {
  roomId: string;
  userId: string;
  members: RoomMemberOption[];
  initialPresence: Presence[];
}

export function PresenceSidebar({
  roomId,
  userId,
  members,
  initialPresence,
}: PresenceSidebarProps) {
  const [presence, setPresenceState] = useState<Record<string, Presence>>(() =>
    Object.fromEntries(initialPresence.map((row) => [row.user_id, row])),
  );
  const [, startTransition] = useTransition();

  usePresenceRealtime(roomId, {
    onUpsert: (row) =>
      setPresenceState((prev) => ({ ...prev, [row.user_id]: row })),
    onDelete: (key) =>
      setPresenceState((prev) => {
        const next = { ...prev };
        delete next[key.user_id];
        return next;
      }),
  });

  const ownView = presenceView(presence[userId]);
  const ownStatus = ownView.kind === "status" ? ownView.status : "studying";
  const ownBackAt = ownView.kind === "status" ? ownView.backAt : null;

  function handleSelect(status: PresenceStatus, backAt: string | null) {
    const snapshot = presence;
    setPresenceState((prev) => ({
      ...prev,
      [userId]: {
        room_id: roomId,
        user_id: userId,
        status,
        back_at: backAt,
        updated_at: new Date().toISOString(),
      },
    }));
    startTransition(async () => {
      const result = await setPresence({ roomId, status, backAt });
      if (!result.ok) {
        setPresenceState(snapshot);
        toast.error(result.error);
      }
    });
  }

  const sorted = useMemo(() => {
    return members
      .map((member) => ({ member, view: presenceView(presence[member.id]) }))
      .sort(
        (a, b) =>
          presenceSortKey(a.view) - presenceSortKey(b.view) ||
          a.member.name.localeCompare(b.member.name),
      );
  }, [members, presence]);

  return (
    <div className="space-y-3">
      <StatusControl
        status={ownStatus}
        backAt={ownBackAt}
        onSelect={handleSelect}
      />

      <div>
        <h2 className="mb-2 font-semibold">{copy.presence.title}</h2>
        <ul className="space-y-1">
          {sorted.map(({ member, view }) => (
            <li
              key={member.id}
              className="flex items-center justify-between gap-2 rounded-md px-1 py-1.5"
            >
              <div className="flex min-w-0 items-center gap-2">
                <UserAvatar
                  name={member.name}
                  avatarUrl={member.avatarUrl}
                  className="size-7"
                  fallbackClassName="text-[11px]"
                  loadout={member.loadout}
                />
                <span
                  className="truncate text-sm"
                  style={
                    member.loadout?.color
                      ? { color: member.loadout.color.value }
                      : undefined
                  }
                >
                  {member.name}
                  {member.id === userId && (
                    <span className="text-muted-foreground"> ({copy.rooms.you})</span>
                  )}
                </span>
              </div>
              {view.kind === "lastSeen" ? (
                <span className="shrink-0 text-xs text-muted-foreground">
                  {copy.presence.lastSeen(view.time)}
                </span>
              ) : (
                <span className="shrink-0 text-xs">
                  {PRESENCE_EMOJI[view.status]}{" "}
                  {copy.presence.statuses[view.status]}
                  {view.backAt && (
                    <span className="text-muted-foreground">
                      {" "}
                      · {copy.presence.backAt} {formatTime(view.backAt)}
                    </span>
                  )}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
