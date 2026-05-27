"use server";

import type { ActionResult } from "@/app/_actions/types";
import { copy } from "@/lib/copy";
import { isWithin } from "@/lib/geo";
import { createClient } from "@/lib/supabase/server";
import { todayInBrussels } from "@/lib/time";
import {
  checkInSchema,
  reportLocationSchema,
  setPresenceSchema,
  STATUSES_WITH_BACK_AT,
  type CheckInInput,
  type ReportLocationInput,
  type SetPresenceInput,
} from "@/lib/validation/presence";

export type ReportLocationResult =
  | { ok: true; located: boolean; atLocation: boolean | null }
  | { ok: false; error: string };

export async function setPresence(
  input: SetPresenceInput,
): Promise<ActionResult> {
  const parsed = setPresenceSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: copy.common.genericError };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: copy.common.notAuthenticated };

  // back_at only applies to break/lunch; clear it otherwise.
  const backAt = STATUSES_WITH_BACK_AT.includes(parsed.data.status)
    ? (parsed.data.backAt ?? null)
    : null;

  const { error } = await supabase.from("presence").upsert(
    {
      room_id: parsed.data.roomId,
      user_id: user.id,
      status: parsed.data.status,
      back_at: backAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "room_id,user_id" },
  );

  if (error) {
    console.error("[setPresence]", error);
    return { ok: false, error: copy.common.genericError };
  }

  return { ok: true };
}

/**
 * Compares a browser position against the room geofence and records only the
 * verdict (at_location + when), never the raw coordinates. Leaves the manual
 * status and its freshness (`updated_at`) untouched.
 */
export async function reportLocation(
  input: ReportLocationInput,
): Promise<ReportLocationResult> {
  const parsed = reportLocationSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: copy.common.genericError };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: copy.common.notAuthenticated };

  const { data: room } = await supabase
    .from("rooms")
    .select("lat, lng, radius_m")
    .eq("id", parsed.data.roomId)
    .maybeSingle();

  // No geofence configured → nothing to compare against.
  if (!room || room.lat == null || room.lng == null) {
    return { ok: true, located: false, atLocation: null };
  }

  const atLocation = isWithin(
    { lat: parsed.data.lat, lng: parsed.data.lng },
    { lat: room.lat, lng: room.lng },
    room.radius_m,
  );

  const fields = {
    at_location: atLocation,
    location_checked_at: new Date().toISOString(),
  };

  // Update only the location columns; insert a default row if none exists yet.
  const { data: updated, error: updateError } = await supabase
    .from("presence")
    .update(fields)
    .eq("room_id", parsed.data.roomId)
    .eq("user_id", user.id)
    .select("user_id");

  if (updateError) {
    console.error("[reportLocation:update]", updateError);
    return { ok: false, error: copy.common.genericError };
  }

  if (!updated || updated.length === 0) {
    const { error: insertError } = await supabase.from("presence").insert({
      room_id: parsed.data.roomId,
      user_id: user.id,
      status: "studying",
      ...fields,
    });
    if (insertError) {
      console.error("[reportLocation:insert]", insertError);
      return { ok: false, error: copy.common.genericError };
    }
  }

  return { ok: true, located: true, atLocation };
}

/**
 * Manual "I'm here today" check-in — present without sharing location. Sets
 * (or clears) `checked_in_on` to today's Brussels date; leaves the manual
 * status alone but refreshes `updated_at` (it's a real interaction).
 */
export async function setCheckIn(input: CheckInInput): Promise<ActionResult> {
  const parsed = checkInSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: copy.common.genericError };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: copy.common.notAuthenticated };

  const fields = {
    checked_in_on: parsed.data.checkedIn ? todayInBrussels() : null,
    updated_at: new Date().toISOString(),
  };

  const { data: updated, error: updateError } = await supabase
    .from("presence")
    .update(fields)
    .eq("room_id", parsed.data.roomId)
    .eq("user_id", user.id)
    .select("user_id");

  if (updateError) {
    console.error("[setCheckIn:update]", updateError);
    return { ok: false, error: copy.common.genericError };
  }

  if (!updated || updated.length === 0) {
    const { error: insertError } = await supabase.from("presence").insert({
      room_id: parsed.data.roomId,
      user_id: user.id,
      status: "studying",
      ...fields,
    });
    if (insertError) {
      console.error("[setCheckIn:insert]", insertError);
      return { ok: false, error: copy.common.genericError };
    }
  }

  return { ok: true };
}
