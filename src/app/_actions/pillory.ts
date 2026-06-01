"use server";

import type { ActionResult } from "@/app/_actions/types";
import { copy } from "@/lib/copy";
import { requireRoomAccess } from "@/lib/rooms/queries";
import { createClient } from "@/lib/supabase/server";

const REASON_MAX = 80;

/** Put a member on the schandpaal with a public reason (owner/admin only). */
export async function setPillory(
  roomId: string,
  targetUserId: string,
  reason?: string,
): Promise<ActionResult> {
  const access = await requireRoomAccess(roomId);
  if (!access) return { ok: false, error: copy.common.notAuthenticated };
  if (!access.canManage) return { ok: false, error: copy.rooms.onlyOwner };

  const supabase = await createClient();
  // Upsert so re-shaming updates the reason (manager has insert; the manager
  // also owns the row's reason — RLS only needs insert/delete here).
  const { error } = await supabase
    .from("room_pillory")
    .delete()
    .eq("room_id", roomId)
    .eq("user_id", targetUserId);
  if (error) {
    console.error("[setPillory:clear]", error);
    return { ok: false, error: copy.common.genericError };
  }
  const insert = await supabase.from("room_pillory").insert({
    room_id: roomId,
    user_id: targetUserId,
    created_by: access.userId,
    reason: reason?.trim().slice(0, REASON_MAX) || null,
  });
  if (insert.error) {
    console.error("[setPillory]", insert.error);
    return { ok: false, error: copy.common.genericError };
  }
  return { ok: true };
}

/** Take a member off the schandpaal (owner/admin only). */
export async function clearPillory(
  roomId: string,
  targetUserId: string,
): Promise<ActionResult> {
  const access = await requireRoomAccess(roomId);
  if (!access) return { ok: false, error: copy.common.notAuthenticated };
  if (!access.canManage) return { ok: false, error: copy.rooms.onlyOwner };

  const supabase = await createClient();
  const { error } = await supabase
    .from("room_pillory")
    .delete()
    .eq("room_id", roomId)
    .eq("user_id", targetUserId);
  if (error) {
    console.error("[clearPillory]", error);
    return { ok: false, error: copy.common.genericError };
  }
  return { ok: true };
}
