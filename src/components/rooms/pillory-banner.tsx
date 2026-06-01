"use client";

import { useState } from "react";

import { UserAvatar } from "@/components/user-avatar";
import { usePilloryRealtime } from "@/hooks/use-pillory-realtime";
import { copy } from "@/lib/copy";
import type { MemberMap } from "@/lib/members";
import type { PilloryEntry } from "@/lib/rooms/pillory-queries";

/** Public banner naming everyone on the room's schandpaal (and why). */
export function PilloryBanner({
  roomId,
  members,
  initialEntries,
}: {
  roomId: string;
  members: MemberMap;
  initialEntries: PilloryEntry[];
}) {
  const [entries, setEntries] = useState<PilloryEntry[]>(initialEntries);

  usePilloryRealtime(roomId, {
    onInsert: (entry) =>
      setEntries((prev) =>
        prev.some((e) => e.userId === entry.userId)
          ? prev.map((e) => (e.userId === entry.userId ? entry : e))
          : [...prev, entry],
      ),
    onDelete: (userId) =>
      setEntries((prev) => prev.filter((e) => e.userId !== userId)),
  });

  if (entries.length === 0) return null;

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
    </div>
  );
}
