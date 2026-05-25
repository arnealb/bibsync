"use server";

import type { ActionResult } from "@/app/_actions/types";
import { copy } from "@/lib/copy";
import {
  INSTANT_BREAK_THRESHOLD,
  INSTANT_BREAK_WINDOW_SECONDS,
} from "@/lib/instant-break/config";
import { isBreakActive } from "@/lib/instant-break/status";
import { createClient } from "@/lib/supabase/server";
import {
  pushInstantBreakSchema,
  type PushInstantBreakInput,
} from "@/lib/validation/instant-break";

/**
 * Records a "Pauze nu" press. When enough distinct members have pressed within
 * the rolling window, declares an instant break for the whole room. The break
 * is broadcast to everyone via realtime; this returns only success/failure.
 */
export async function pushInstantBreak(
  input: PushInstantBreakInput,
): Promise<ActionResult> {
  const parsed = pushInstantBreakSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: copy.common.genericError };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: copy.common.notAuthenticated };

  const { roomId, durationMinutes } = parsed.data;

  // Already on a break? Pressing again is a no-op.
  const { data: latest } = await supabase
    .from("instant_breaks")
    .select("*")
    .eq("room_id", roomId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latest && isBreakActive(latest, Date.now())) return { ok: true };

  // Record this press.
  const { error: pushError } = await supabase
    .from("instant_break_pushes")
    .insert({
      room_id: roomId,
      user_id: user.id,
      duration_minutes: durationMinutes,
    });
  if (pushError) {
    console.error("[pushInstantBreak:push]", pushError);
    return { ok: false, error: copy.common.genericError };
  }

  // Enough distinct people within the window? Declare the break.
  const cutoff = new Date(
    Date.now() - INSTANT_BREAK_WINDOW_SECONDS * 1000,
  ).toISOString();
  const { data: recent } = await supabase
    .from("instant_break_pushes")
    .select("user_id")
    .eq("room_id", roomId)
    .gte("created_at", cutoff);

  const distinct = new Set((recent ?? []).map((row) => row.user_id));
  if (distinct.size >= INSTANT_BREAK_THRESHOLD) {
    const { error: breakError } = await supabase
      .from("instant_breaks")
      .insert({
        room_id: roomId,
        triggered_by: user.id,
        duration_minutes: durationMinutes,
      });
    if (breakError) {
      // The press itself succeeded; the break failing to insert is not fatal
      // for this user, and another press will retry the declaration.
      console.error("[pushInstantBreak:break]", breakError);
    }
  }

  return { ok: true };
}
