"use client";

import { useEffect, useRef } from "react";

export type TableGame = "blackjack" | "poker";

/** Free the seat after this long without any user interaction. */
const DEFAULT_IDLE_MS = 3 * 60 * 1000;
const IDLE_CHECK_MS = 20_000;
const ACTIVITY_EVENTS = [
  "pointerdown",
  "keydown",
  "touchstart",
  "mousemove",
  "scroll",
] as const;

// Pending leaves keyed by game:room. A StrictMode remount (or a quick
// navigate-back) cancels the leave its predecessor scheduled, so we don't free
// the seat spuriously.
const pendingLeaves = new Map<string, number>();

/**
 * Frees the player's seat when they leave the table — three ways:
 *   - SPA navigation away → the panel unmounts → call the (idempotent) leave
 *     action after a short tick (cancelled by an immediate remount).
 *   - tab close / refresh → `pagehide` fires a `sendBeacon` to a route handler,
 *     since React cleanups don't run on teardown.
 *   - inactivity → while seated (`armed`), no interaction for `idleMs` leaves
 *     the table so an AFK player can't block it.
 * All paths are no-ops server-side when the user isn't seated.
 */
export function useAutoLeaveTable(
  game: TableGame,
  roomId: string,
  leave: () => Promise<unknown>,
  options?: { armed?: boolean; idleMs?: number },
) {
  const armed = options?.armed ?? false;
  const idleMs = options?.idleMs ?? DEFAULT_IDLE_MS;

  const leaveRef = useRef(leave);
  useEffect(() => {
    leaveRef.current = leave;
  });

  // Exit paths: SPA unmount + tab close.
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

  // Inactivity path: only while seated.
  useEffect(() => {
    if (!armed) return;
    let lastActive = Date.now();
    let fired = false;
    const bump = () => {
      lastActive = Date.now();
    };
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, bump, { passive: true });
    }
    const onVisible = () => {
      if (document.visibilityState === "visible") lastActive = Date.now();
    };
    document.addEventListener("visibilitychange", onVisible);

    const id = window.setInterval(() => {
      if (!fired && Date.now() - lastActive >= idleMs) {
        fired = true;
        void leaveRef.current();
      }
    }, IDLE_CHECK_MS);

    return () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, bump);
      }
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(id);
    };
  }, [armed, idleMs]);
}
