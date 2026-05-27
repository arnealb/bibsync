/**
 * Per-room unread-chat tracking for the in-app badge (iPhone-homescreen style).
 *
 * "Read" state is stored per room in localStorage as the ISO timestamp of the
 * moment the user last looked at the chat. The chat page advances that marker
 * on enter and leave; the badge counts messages newer than the marker. A tiny
 * in-tab pub/sub lets the always-mounted tab badge reset the instant the chat
 * marks itself read, without prop-drilling through the layout.
 */

const STORAGE_PREFIX = "bibsync:chat-read:";
const MAX_BADGE = 99;

function storageKey(roomId: string): string {
  return `${STORAGE_PREFIX}${roomId}`;
}

/** ISO timestamp of the last message the user has seen in this room, if any. */
export function readChatLastSeen(roomId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(storageKey(roomId));
  } catch {
    return null;
  }
}

type ReadListener = (roomId: string) => void;
const listeners = new Set<ReadListener>();

/** Marks the room's chat as read (now) and notifies any open badges. */
export function markChatRead(roomId: string): void {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(storageKey(roomId), new Date().toISOString());
    } catch {
      // Ignore storage failures (private mode / quota) — the live badge still
      // works via the realtime subscription within this session.
    }
  }
  for (const listener of listeners) listener(roomId);
}

/** Subscribes to "chat read" events; returns an unsubscribe function. */
export function onChatRead(listener: ReadListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** iPhone-style badge text: the count, capped at "99+". Empty when zero. */
export function formatUnreadBadge(count: number): string {
  if (count <= 0) return "";
  return count > MAX_BADGE ? `${MAX_BADGE}+` : String(count);
}
