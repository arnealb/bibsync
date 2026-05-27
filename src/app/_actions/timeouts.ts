"use server";

import type { ActionResult } from "@/app/_actions/types";
import { copy } from "@/lib/copy";
import { requireRoomAccess } from "@/lib/rooms/queries";
import { createClient } from "@/lib/supabase/server";

/** Puts a member in timeout (owner/admin only). */
export async function setUserTimeout(
  roomId: string,
  targetUserId: string,
): Promise<ActionResult> {
  const access = await requireRoomAccess(roomId);
  if (!access) return { ok: false, error: copy.common.notAuthenticated };
  if (!access.canManage) return { ok: false, error: copy.rooms.onlyOwner };

  const supabase = await createClient();
  // ON CONFLICT DO NOTHING (re-timeout is a no-op) so only an INSERT policy is
  // needed — no UPDATE policy on room_timeouts.
  const { error } = await supabase.from("room_timeouts").upsert(
    {
      room_id: roomId,
      user_id: targetUserId,
      created_by: access.userId,
    },
    { onConflict: "room_id,user_id", ignoreDuplicates: true },
  );
  if (error) {
    console.error("[setUserTimeout]", error);
    return { ok: false, error: copy.common.genericError };
  }
  return { ok: true };
}

/** Lifts a member's timeout (owner/admin only). */
export async function clearUserTimeout(
  roomId: string,
  targetUserId: string,
): Promise<ActionResult> {
  const access = await requireRoomAccess(roomId);
  if (!access) return { ok: false, error: copy.common.notAuthenticated };
  if (!access.canManage) return { ok: false, error: copy.rooms.onlyOwner };

  const supabase = await createClient();
  const { error } = await supabase
    .from("room_timeouts")
    .delete()
    .eq("room_id", roomId)
    .eq("user_id", targetUserId);
  if (error) {
    console.error("[clearUserTimeout]", error);
    return { ok: false, error: copy.common.genericError };
  }
  return { ok: true };
}
