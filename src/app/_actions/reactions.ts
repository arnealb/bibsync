"use server";

import type { ActionResult } from "@/app/_actions/types";
import { copy } from "@/lib/copy";
import { isOnPillory } from "@/lib/rooms/pillory-queries";
import { createClient } from "@/lib/supabase/server";
import {
  toggleReactionSchema,
  type ToggleReactionInput,
} from "@/lib/validation/reactions";

/** Adds the reaction if absent, removes it if the user already reacted. */
export async function toggleMessageReaction(
  input: ToggleReactionInput,
): Promise<ActionResult> {
  const parsed = toggleReactionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: copy.common.genericError };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: copy.common.notAuthenticated };

  const { data: msg } = await supabase
    .from("messages")
    .select("room_id")
    .eq("id", parsed.data.messageId)
    .maybeSingle();
  if (!msg) return { ok: false, error: copy.common.genericError };
  if (await isOnPillory(msg.room_id, user.id)) {
    return { ok: false, error: copy.pillory.frozen };
  }

  const match = supabase
    .from("message_reactions")
    .select("message_id")
    .eq("message_id", parsed.data.messageId)
    .eq("user_id", user.id)
    .eq("emoji", parsed.data.emoji);

  const { data: existing } = await match.maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("message_reactions")
      .delete()
      .eq("message_id", parsed.data.messageId)
      .eq("user_id", user.id)
      .eq("emoji", parsed.data.emoji);
    if (error) {
      console.error("[toggleMessageReaction:delete]", error);
      return { ok: false, error: copy.common.genericError };
    }
    return { ok: true };
  }

  const { error } = await supabase.from("message_reactions").insert({
    message_id: parsed.data.messageId,
    user_id: user.id,
    emoji: parsed.data.emoji,
    room_id: msg.room_id,
  });
  if (error) {
    console.error("[toggleMessageReaction:insert]", error);
    return { ok: false, error: copy.common.genericError };
  }
  return { ok: true };
}
