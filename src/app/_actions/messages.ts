"use server";

import { copy } from "@/lib/copy";
import { createClient } from "@/lib/supabase/server";
import {
  MESSAGE_PAGE_SIZE,
  sendMessageSchema,
  type SendMessageInput,
} from "@/lib/validation/messages";
import type { Message } from "@/types/database";

export type SendMessageResult =
  | { ok: true; message: Message }
  | { ok: false; error: string };

export async function sendMessage(
  input: SendMessageInput,
): Promise<SendMessageResult> {
  const parsed = sendMessageSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: copy.chat.error };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: copy.common.notAuthenticated };

  const { data, error } = await supabase
    .from("messages")
    .insert({
      room_id: parsed.data.roomId,
      author_id: user.id,
      content: parsed.data.content,
    })
    .select("*")
    .single();

  if (error || !data) {
    console.error("[sendMessage]", error);
    return { ok: false, error: copy.chat.error };
  }

  return { ok: true, message: data };
}

export interface OlderMessagesResult {
  messages: Message[];
  hasMore: boolean;
}

/** Loads the page of messages immediately older than `before` (a timestamp). */
export async function loadOlderMessages(
  roomId: string,
  before: string,
): Promise<OlderMessagesResult> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("messages")
    .select("*")
    .eq("room_id", roomId)
    .lt("created_at", before)
    .order("created_at", { ascending: false })
    .limit(MESSAGE_PAGE_SIZE);

  const rows = data ?? [];
  return {
    messages: [...rows].reverse(),
    hasMore: rows.length === MESSAGE_PAGE_SIZE,
  };
}
