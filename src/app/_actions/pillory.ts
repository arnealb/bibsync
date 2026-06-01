"use server";

import type { ActionResult } from "@/app/_actions/types";
import { awardBibcoins, spendBibcoins } from "@/lib/bibcoins/award";
import { getBibcoins } from "@/lib/bibcoins/queries";
import { copy } from "@/lib/copy";
import { getAuthContext } from "@/lib/auth";
import {
  PILLORY_BUYOFF_COST,
  PILLORY_MIN_MS,
  PILLORY_SET_COST,
} from "@/lib/rooms/pillory";
import { requireRoomAccess } from "@/lib/rooms/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const REASON_MAX = 80;

export type BuyOffResult =
  | { ok: true; balance: number }
  | { ok: false; error: string };

/** Pay {@link PILLORY_BUYOFF_COST} to take yourself off the schandpaal. */
export async function buyOffPillory(roomId: string): Promise<BuyOffResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { ok: false, error: copy.common.notAuthenticated };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: copy.common.genericError };

  const { data: row } = await admin
    .from("room_pillory")
    .select("user_id, created_at")
    .eq("room_id", roomId)
    .eq("user_id", ctx.user.id)
    .maybeSingle();
  if (!row) return { ok: false, error: copy.pillory.notOnIt };

  // Must serve at least the minimum sentence before buying off.
  const elapsed = Date.now() - Date.parse(row.created_at);
  if (elapsed < PILLORY_MIN_MS) {
    const minsLeft = Math.ceil((PILLORY_MIN_MS - elapsed) / 60_000);
    return { ok: false, error: copy.pillory.tooSoon(minsLeft) };
  }

  const ref = `pillory-buyoff:${roomId}:${ctx.user.id}:${crypto.randomUUID()}`;
  const paid = await spendBibcoins(
    ctx.user.id,
    PILLORY_BUYOFF_COST,
    "pillory_buyoff",
    ref,
  );
  if (!paid) return { ok: false, error: copy.pillory.cantAfford };

  // RLS only lets owner/admin delete, so remove the row with the service role.
  const { error } = await admin
    .from("room_pillory")
    .delete()
    .eq("room_id", roomId)
    .eq("user_id", ctx.user.id);
  if (error) {
    console.error("[buyOffPillory]", error);
    await awardBibcoins(ctx.user.id, PILLORY_BUYOFF_COST, "pillory_refund", ref);
    return { ok: false, error: copy.common.genericError };
  }
  return { ok: true, balance: await getBibcoins(ctx.user.id) };
}

/** Put a member on the schandpaal with a public reason (owner/admin only). */
export async function setPillory(
  roomId: string,
  targetUserId: string,
  reason?: string,
): Promise<ActionResult> {
  const access = await requireRoomAccess(roomId);
  if (!access) return { ok: false, error: copy.common.notAuthenticated };
  if (!access.canManage) return { ok: false, error: copy.rooms.onlyOwner };

  const admin = createAdminClient();
  if (!admin) return { ok: false, error: copy.common.genericError };

  // Charge only when newly shaming — updating an existing reason is free.
  const { data: existing } = await admin
    .from("room_pillory")
    .select("user_id")
    .eq("room_id", roomId)
    .eq("user_id", targetUserId)
    .maybeSingle();

  const ref = `pillory-set:${roomId}:${targetUserId}:${crypto.randomUUID()}`;
  if (!existing) {
    const paid = await spendBibcoins(
      access.userId,
      PILLORY_SET_COST,
      "pillory_set",
      ref,
    );
    if (!paid) return { ok: false, error: copy.pillory.cantAffordSet };
  }

  const supabase = await createClient();
  // Re-shaming updates the reason: delete then insert (manager has insert/delete
  // via RLS; the new row resets the 1h buy-off timer too).
  const { error } = await supabase
    .from("room_pillory")
    .delete()
    .eq("room_id", roomId)
    .eq("user_id", targetUserId);
  if (error) {
    console.error("[setPillory:clear]", error);
    if (!existing) {
      await awardBibcoins(access.userId, PILLORY_SET_COST, "pillory_set_refund", ref);
    }
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
    if (!existing) {
      await awardBibcoins(access.userId, PILLORY_SET_COST, "pillory_set_refund", ref);
    }
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
