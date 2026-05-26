"use server";

import { randomBytes } from "node:crypto";

import { earnFromSteps } from "@/lib/bibcoins/earn";
import { copy } from "@/lib/copy";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  saveStepSessionSchema,
  type SaveStepSessionInput,
} from "@/lib/validation/steps";

export type SaveStepSessionResult =
  | { ok: true; steps: number }
  | { ok: false; error: string };

/** Saves a browser-pedometer session for the caller and awards step bibcoins. */
export async function saveStepSession(
  input: SaveStepSessionInput,
): Promise<SaveStepSessionResult> {
  const parsed = saveStepSessionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? copy.common.genericError,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: copy.common.notAuthenticated };

  // RLS guarantees the caller is a member of the room; source is forced here so
  // a client can never pass itself off as a verified 'health' entry.
  const { error } = await supabase.from("step_sessions").insert({
    room_id: parsed.data.roomId,
    user_id: user.id,
    steps: parsed.data.steps,
    source: "browser",
  });
  if (error) {
    console.error("[saveStepSession]", error);
    return { ok: false, error: copy.common.genericError };
  }

  await earnFromSteps(user.id);
  return { ok: true, steps: parsed.data.steps };
}

export type HealthTokenResult =
  | { ok: true; token: string }
  | { ok: false; error: string };

/** (Re)generates the caller's Apple Health sync token. Service-role write. */
export async function regenerateHealthToken(): Promise<HealthTokenResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: copy.common.notAuthenticated };

  const admin = createAdminClient();
  if (!admin) return { ok: false, error: copy.steps.health.noService };

  const token = `bib_${randomBytes(24).toString("hex")}`;
  const { error } = await admin
    .from("health_tokens")
    .upsert({ user_id: user.id, token }, { onConflict: "user_id" });
  if (error) {
    console.error("[regenerateHealthToken]", error);
    return { ok: false, error: copy.common.genericError };
  }
  return { ok: true, token };
}
