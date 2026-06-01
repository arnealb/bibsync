"use client";

import { useEffect, useState, useTransition } from "react";
import { Gavel, Lock } from "lucide-react";
import { toast } from "sonner";

import { buyOffPillory } from "@/app/_actions/pillory";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { usePilloryRealtime } from "@/hooks/use-pillory-realtime";
import { copy } from "@/lib/copy";
import type { MemberMap } from "@/lib/members";
import { PILLORY_BUYOFF_COST, PILLORY_MIN_MS } from "@/lib/rooms/pillory";
import type { PilloryEntry } from "@/lib/rooms/pillory-queries";

/** Public "wanted poster" naming everyone on the room's schandpaal (and why). */
export function PilloryBanner({
  roomId,
  userId,
  members,
  initialEntries,
}: {
  roomId: string;
  userId: string;
  members: MemberMap;
  initialEntries: PilloryEntry[];
}) {
  const [entries, setEntries] = useState<PilloryEntry[]>(initialEntries);
  const [now, setNow] = useState(() => Date.now());
  const [pending, start] = useTransition();

  usePilloryRealtime(roomId, {
    onInsert: (entry) =>
      setEntries((prev) =>
        prev.some((e) => e.userId === entry.userId)
          ? prev.map((e) => (e.userId === entry.userId ? entry : e))
          : [...prev, entry],
      ),
    onDelete: (uid) =>
      setEntries((prev) => prev.filter((e) => e.userId !== uid)),
  });

  const mine = entries.find((e) => e.userId === userId);

  // Tick once every 30s while still locked, so the countdown stays fresh.
  useEffect(() => {
    if (!mine) return;
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [mine]);

  if (entries.length === 0) return null;

  const minsLeft = mine
    ? Math.ceil((PILLORY_MIN_MS - (now - Date.parse(mine.createdAt))) / 60_000)
    : 0;
  const locked = minsLeft > 0;

  function buyOff() {
    start(async () => {
      const res = await buyOffPillory(roomId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setEntries((prev) => prev.filter((e) => e.userId !== userId));
      toast.success(copy.pillory.boughtOff);
    });
  }

  return (
    <div
      role="alert"
      className="overflow-hidden rounded-xl border border-amber-500/40 bg-gradient-to-b from-amber-950/60 to-background shadow-sm ring-1 ring-amber-500/10"
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-amber-500/20 bg-amber-500/10 px-4 py-2.5">
        <Gavel className="size-4 text-amber-500" />
        <h2 className="text-sm font-bold tracking-wide text-amber-200 uppercase">
          {copy.pillory.title}
        </h2>
        <span className="ml-auto rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-300 tabular-nums">
          {entries.length}
        </span>
      </div>

      {/* Offenders */}
      <ul className="divide-y divide-amber-500/10">
        {entries.map((e) => (
          <li
            key={e.userId}
            className="flex items-center gap-3 px-4 py-2.5"
          >
            <div className="relative shrink-0">
              <UserAvatar
                name={members[e.userId]?.name ?? "—"}
                avatarUrl={members[e.userId]?.avatarUrl}
                className="size-8 grayscale"
                fallbackClassName="text-xs"
                loadout={members[e.userId]?.loadout}
              />
              <span className="absolute -right-1.5 -bottom-1.5 text-sm">
                🔨
              </span>
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold text-foreground">
                {members[e.userId]?.name ?? "—"}
              </p>
              {e.reason && (
                <p className="truncate text-sm text-muted-foreground italic">
                  &ldquo;{e.reason}&rdquo;
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>

      {/* Buy-off (only for someone who's on it) */}
      {mine && (
        <div className="flex items-center gap-2 border-t border-amber-500/20 bg-amber-500/5 px-4 py-2.5">
          <Button
            size="sm"
            variant="secondary"
            disabled={pending || locked}
            onClick={buyOff}
          >
            {locked ? (
              <>
                <Lock className="size-3.5" />
                {copy.pillory.lockedFor(minsLeft)}
              </>
            ) : (
              copy.pillory.buyOff(PILLORY_BUYOFF_COST)
            )}
          </Button>
          {locked && (
            <span className="text-xs text-muted-foreground">
              {copy.pillory.buyOffHint(PILLORY_BUYOFF_COST)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
