"use client";

import { useState } from "react";

import { useTimeoutsRealtime } from "@/hooks/use-timeouts-realtime";
import { copy } from "@/lib/copy";

/** Red banner shown to a member who's been put in timeout. */
export function TimeoutBanner({
  roomId,
  userId,
  initialTimedOut,
}: {
  roomId: string;
  userId: string;
  initialTimedOut: boolean;
}) {
  const [timedOut, setTimedOut] = useState(initialTimedOut);

  useTimeoutsRealtime(roomId, {
    onInsert: (uid) => {
      if (uid === userId) setTimedOut(true);
    },
    onDelete: (uid) => {
      if (uid === userId) setTimedOut(false);
    },
  });

  if (!timedOut) return null;

  return (
    <div
      role="alert"
      className="-mx-4 mb-4 flex items-center gap-3 border-y-2 border-red-700 bg-red-600 px-4 py-3 text-white shadow-md"
    >
      <span className="animate-pulse text-2xl">🚨</span>
      <div className="min-w-0">
        <p className="font-bold">{copy.timeout.banner}</p>
        <p className="text-sm text-white/90">{copy.timeout.bannerSub}</p>
      </div>
    </div>
  );
}
