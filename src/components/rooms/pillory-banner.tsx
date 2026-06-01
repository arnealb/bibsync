"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { buyOffPillory } from "@/app/_actions/pillory";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { usePilloryRealtime } from "@/hooks/use-pillory-realtime";
import { copy } from "@/lib/copy";
import type { MemberMap } from "@/lib/members";
import { PILLORY_BUYOFF_COST, PILLORY_MIN_MS } from "@/lib/rooms/pillory";
import type { PilloryEntry } from "@/lib/rooms/pillory-queries";

/** Public banner naming everyone on the room's schandpaal (and why). */
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

  // Tick once a minute while still locked, so the countdown stays fresh.
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
      className="-mx-4 mb-4 border-y-2 border-amber-700 bg-amber-600 px-4 py-3 text-white shadow-md"
    >
      <p className="flex items-center gap-2 font-bold">
        <span className="text-xl">🔨</span>
        {copy.pillory.title}
      </p>
      <ul className="mt-1.5 space-y-1">
        {entries.map((e) => (
          <li key={e.userId} className="flex items-center gap-2 text-sm">
            <UserAvatar
              name={members[e.userId]?.name ?? "—"}
              avatarUrl={members[e.userId]?.avatarUrl}
              className="size-5"
              fallbackClassName="text-[9px]"
              loadout={members[e.userId]?.loadout}
            />
            <span className="font-semibold">
              {members[e.userId]?.name ?? "—"}
            </span>
            {e.reason && <span className="text-white/90">— {e.reason}</span>}
          </li>
        ))}
      </ul>
      {mine && (
        <Button
          size="sm"
          variant="secondary"
          className="mt-2"
          disabled={pending || locked}
          onClick={buyOff}
        >
          {locked
            ? copy.pillory.lockedFor(minsLeft)
            : copy.pillory.buyOff(PILLORY_BUYOFF_COST)}
        </Button>
      )}
    </div>
  );
}
