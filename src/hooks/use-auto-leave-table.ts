"use client";

import { useEffect, useRef } from "react";

export type TableGame = "blackjack" | "poker";

// Pending leaves keyed by game:room. A StrictMode remount (or a quick
// navigate-back) cancels the leave its predecessor scheduled, so we don't free
// the seat spuriously.
const pendingLeaves = new Map<string, number>();

/**
 * Frees the player's seat when they leave the table page:
 *   - SPA navigation away → the panel unmounts → call the (idempotent) leave
 *     action after a short tick (cancelled by an immediate remount).
 *   - tab close / refresh → `pagehide` fires a `sendBeacon` to a route handler,
 *     since React cleanups don't run on teardown.
 * Both are no-ops server-side when the user isn't seated.
 */
export function useAutoLeaveTable(
  game: TableGame,
  roomId: string,
  leave: () => Promise<unknown>,
) {
  const leaveRef = useRef(leave);
  useEffect(() => {
    leaveRef.current = leave;
  });

  useEffect(() => {
    const key = `${game}:${roomId}`;

    const queued = pendingLeaves.get(key);
    if (queued != null) {
      window.clearTimeout(queued);
      pendingLeaves.delete(key);
    }

    const onHide = () => {
      navigator.sendBeacon?.(
        "/api/games/leave",
        new Blob([JSON.stringify({ roomId, game })], {
          type: "application/json",
        }),
      );
    };
    window.addEventListener("pagehide", onHide);

    return () => {
      window.removeEventListener("pagehide", onHide);
      const id = window.setTimeout(() => {
        pendingLeaves.delete(key);
        void leaveRef.current();
      }, 250);
      pendingLeaves.set(key, id);
    };
  }, [game, roomId]);
}
