"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { setPresence } from "@/app/_actions/presence";
import { LocationReporter } from "@/components/presence/location-reporter";
import { StatusControl } from "@/components/presence/status-control";
import { UserAvatar } from "@/components/user-avatar";
import { usePresenceRealtime } from "@/hooks/use-presence-realtime";
import { effectClassName } from "@/lib/cosmetics/effects";
import type { ResolvedLoadout } from "@/lib/cosmetics/resolve";
import { copy } from "@/lib/copy";
import { PRESENCE_EMOJI } from "@/lib/presence/display";
import { locationSortKey, locationStatus } from "@/lib/presence/location";
import { presenceSortKey, presenceView } from "@/lib/presence/view";
import { formatTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { PresenceStatus, Presence } from "@/types/database";

interface RoomMemberOption {
  id: string;
  name: string;
  avatarUrl: string | null;
  loadout?: ResolvedLoadout | null;
}

/** Module-scope clock read so render stays pure (no Date.now in render). */
function nowMs(): number {
  return Date.now();
}

interface PresenceSidebarProps {
  roomId: string;
  userId: string;
  members: RoomMemberOption[];
  initialPresence: Presence[];
  hasLocation: boolean;
  canManage: boolean;
}

export function PresenceSidebar({
  roomId,
  userId,
  members,
  initialPresence,
  hasLocation,
  canManage,
}: PresenceSidebarProps) {
  const [presence, setPresenceState] = useState<Record<string, Presence>>(() =>
    Object.fromEntries(initialPresence.map((row) => [row.user_id, row])),
  );
  const [, startTransition] = useTransition();
  // Ticking clock so location readings flip to "unknown" as they go stale.
  // Starts at 0 (location shown as unknown) and is set to a real time on the
  // first tick — keeps Date.now() out of render.
  const [clock, setClock] = useState(0);
  useEffect(() => {
    const tick = () => setClock(nowMs());
    const first = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, 60_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, []);

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
        at_location: prev[userId]?.at_location ?? null,
        location_checked_at: prev[userId]?.location_checked_at ?? null,
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
      .map((member) => ({
        member,
        view: presenceView(presence[member.id]),
        loc:
          clock === 0
            ? ("unknown" as const)
            : locationStatus(presence[member.id], clock),
      }))
      .sort(
        (a, b) =>
          locationSortKey(a.loc) - locationSortKey(b.loc) ||
          presenceSortKey(a.view) - presenceSortKey(b.view) ||
          a.member.name.localeCompare(b.member.name),
      );
  }, [members, presence, clock]);

  return (
    <div className="space-y-3">
      <StatusControl
        status={ownStatus}
        backAt={ownBackAt}
        onSelect={handleSelect}
      />

      <LocationReporter
        roomId={roomId}
        hasLocation={hasLocation}
        canManage={canManage}
      />

      <div>
        <h2 className="mb-2 font-semibold">{copy.presence.title}</h2>
        <ul className="space-y-1">
          {sorted.map(({ member, view, loc }) => (
            <li
              key={member.id}
              className={cn(
                "flex items-center justify-between gap-2 rounded-md px-1 py-1.5",
                loc === "away" && "opacity-60",
              )}
            >
              <div className="flex min-w-0 items-center gap-2">
                <UserAvatar
                  name={member.name}
                  avatarUrl={member.avatarUrl}
                  className="size-7"
                  fallbackClassName="text-[11px]"
                  loadout={member.loadout}
                />
                <span className="flex min-w-0 items-center gap-1">
                  <span
                    className={cn(
                      "truncate text-sm",
                      effectClassName(member.loadout?.effect?.value),
                    )}
                    style={
                      member.loadout?.color && !member.loadout?.effect
                        ? { color: member.loadout.color.value }
                        : undefined
                    }
                  >
                    {member.name}
                    {member.id === userId && (
                      <span className="text-muted-foreground"> ({copy.rooms.you})</span>
                    )}
                  </span>
                  {member.loadout?.title && (
                    <span className="shrink-0 rounded bg-muted px-1 text-[10px] font-semibold whitespace-nowrap">
                      {member.loadout.title.value}
                    </span>
                  )}
                </span>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-0.5 text-xs">
                {view.kind === "lastSeen" ? (
                  <span className="text-muted-foreground">
                    {copy.presence.lastSeen(view.time)}
                  </span>
                ) : (
                  <span>
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
                {loc === "here" && (
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                    {copy.presence.location.here}
                  </span>
                )}
                {loc === "away" && (
                  <span className="text-amber-600 dark:text-amber-500">
                    {copy.presence.location.away}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
