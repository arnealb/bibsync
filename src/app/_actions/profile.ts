"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { format } from "date-fns";
import { tz } from "@date-fns/tz";

import type { ActionResult } from "@/app/_actions/types";
import { getWallet } from "@/lib/bibcoins/queries";
import { copy } from "@/lib/copy";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { TIME_ZONE } from "@/lib/time";
import {
  DISPLAY_NAME_CHANGE_COST,
  displayNameSchema,
} from "@/lib/validation/profile";

const avatarSchema = z.object({ avatarUrl: z.string().url().nullable() });

export async function updateAvatar(
  avatarUrl: string | null,
): Promise<ActionResult> {
  const parsed = avatarSchema.safeParse({ avatarUrl });
  if (!parsed.success) return { ok: false, error: copy.common.genericError };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: copy.common.notAuthenticated };

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: parsed.data.avatarUrl })
    .eq("id", user.id);

  if (error) {
    console.error("[updateAvatar]", error);
    return { ok: false, error: copy.common.genericError };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Change the user's display name. Costs {@link DISPLAY_NAME_CHANGE_COST}
 * bibcoins and is capped to once per Brussels day. The spend ref is keyed on
 * the day so a raced double-submit can't charge twice.
 */
export async function updateDisplayName(name: string): Promise<ActionResult> {
  const parsed = displayNameSchema.safeParse(name);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? copy.common.genericError,
    };
  }
  const newName = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: copy.common.notAuthenticated };

  const { data: profile, error: readError } = await supabase
    .from("profiles")
    .select("display_name, display_name_changed_on")
    .eq("id", user.id)
    .maybeSingle();
  if (readError || !profile) {
    console.error("[updateDisplayName] read", readError);
    return { ok: false, error: copy.common.genericError };
  }

  if (profile.display_name === newName) {
    return { ok: false, error: copy.profile.nameEdit.unchanged };
  }

  const today = format(new Date(), "yyyy-MM-dd", { ...tz(TIME_ZONE) });
  if (profile.display_name_changed_on === today) {
    return { ok: false, error: copy.profile.nameEdit.alreadyToday };
  }

  const wallet = await getWallet(user.id);
  if (!wallet || wallet.balance < DISPLAY_NAME_CHANGE_COST) {
    return {
      ok: false,
      error: copy.profile.nameEdit.insufficient(DISPLAY_NAME_CHANGE_COST),
    };
  }

  const admin = createAdminClient();
  const { error: spendError } = await admin.rpc("spend_bibcoins", {
    p_user_id: user.id,
    p_amount: DISPLAY_NAME_CHANGE_COST,
    p_reason: "name-change",
    p_ref: `name-change:${user.id}:${today}`,
  });
  if (spendError) {
    console.error("[updateDisplayName] spend", spendError);
    return {
      ok: false,
      error: copy.profile.nameEdit.insufficient(DISPLAY_NAME_CHANGE_COST),
    };
  }

  const { error: updateError } = await admin
    .from("profiles")
    .update({ display_name: newName, display_name_changed_on: today })
    .eq("id", user.id);
  if (updateError) {
    console.error("[updateDisplayName] update", updateError);
    return { ok: false, error: copy.profile.nameEdit.error };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}
