"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionResult } from "@/app/_actions/types";
import { copy } from "@/lib/copy";
import { createClient } from "@/lib/supabase/server";

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
