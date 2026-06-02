import { copy } from "@/lib/copy";

/**
 * A member on the room's schandpaal is frozen out of *every* room action —
 * games, chat, reactions, voting, the lot. The only escape is buying yourself
 * off (and stealing, which is a global action and never routes through here).
 *
 * Call right after `requireRoomAccess`: `const f = pilloryGuard(access); if (f) return f;`.
 * Typed structurally so it doesn't import `RoomAccess` (avoids a cycle).
 */
export function pilloryGuard(access: {
  isPilloried: boolean;
}): { ok: false; error: string } | null {
  return access.isPilloried ? { ok: false, error: copy.pillory.frozen } : null;
}
