"use server";

import type { ActionResult } from "@/app/_actions/types";
import { earnFromMessage } from "@/lib/bibcoins/earn";
import { isGifUrl } from "@/lib/chat/gif";
import { copy } from "@/lib/copy";
import { sendRoomPush } from "@/lib/push/send";
import { createClient } from "@/lib/supabase/server";
import {
  editMessageSchema,
  MESSAGE_PAGE_SIZE,
  sendMessageSchema,
  type EditMessageInput,
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

  const preview = isGifUrl(parsed.data.content)
    ? copy.push.gifMessage
    : parsed.data.content.slice(0, 120);
  await sendRoomPush(parsed.data.roomId, "chat", {
    title: copy.push.newMessage,
    body: preview,
    url: `/app/rooms/${parsed.data.roomId}`,
    tag: `chat-${parsed.data.roomId}`,
  });

  await earnFromMessage(user.id);
  return { ok: true, message: data };
}

/** Edit one of your own messages. RLS restricts this to the author. */
export async function editMessage(
  input: EditMessageInput,
): Promise<ActionResult> {
  const parsed = editMessageSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: copy.chat.error };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: copy.common.notAuthenticated };

  const { error } = await supabase
    .from("messages")
    .update({
      content: parsed.data.content,
      edited_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.messageId)
    .eq("author_id", user.id);

  if (error) {
    console.error("[editMessage]", error);
    return { ok: false, error: copy.chat.error };
  }
  return { ok: true };
}

/** Delete one of your own messages. RLS restricts this to the author. */
export async function deleteMessage(messageId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: copy.common.notAuthenticated };

  const { error } = await supabase
    .from("messages")
    .delete()
    .eq("id", messageId)
    .eq("author_id", user.id);

  if (error) {
    console.error("[deleteMessage]", error);
    return { ok: false, error: copy.chat.error };
  }
  return { ok: true };
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
