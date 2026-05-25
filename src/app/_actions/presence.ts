"use server";

import type { ActionResult } from "@/app/_actions/types";
import { copy } from "@/lib/copy";
import { createClient } from "@/lib/supabase/server";
import {
  setPresenceSchema,
  STATUSES_WITH_BACK_AT,
  type SetPresenceInput,
} from "@/lib/validation/presence";

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
