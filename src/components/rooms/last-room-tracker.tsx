"use client";

import { useEffect } from "react";

import { LAST_ROOM_COOKIE } from "@/lib/rooms/constants";

const THIRTY_DAYS = 60 * 60 * 24 * 30;

/** Remembers the current room so `/app` can route straight back to it. */
export function LastRoomTracker({ roomId }: { roomId: string }) {
  useEffect(() => {
    document.cookie = `${LAST_ROOM_COOKIE}=${roomId}; path=/; max-age=${THIRTY_DAYS}; samesite=lax`;
  }, [roomId]);
  return null;
}
