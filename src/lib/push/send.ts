import "server-only";

import webpush from "web-push";

import { createClient } from "@/lib/supabase/server";

let configured = false;

function ensureConfigured(): boolean {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return false;
  if (!configured) {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    configured = true;
  }
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/**
 * Sends a push to the room members (except the caller) who opted in to `pref`.
 * No-op when VAPID isn't configured. Failures are logged, not thrown, so a
 * notification problem never breaks the action that triggered it.
 */
export async function sendRoomPush(
  roomId: string,
  pref: "proposals" | "food",
  payload: PushPayload,
): Promise<void> {
  if (!ensureConfigured()) return;

  const supabase = await createClient();
  const { data: targets } = await supabase.rpc("get_push_targets", {
    _room_id: roomId,
    _pref: pref,
  });
  if (!targets || targets.length === 0) return;

  const body = JSON.stringify(payload);
  await Promise.allSettled(
    targets.map((target) =>
      webpush
        .sendNotification(
          {
            endpoint: target.endpoint,
            keys: { p256dh: target.p256dh, auth: target.auth },
          },
          body,
        )
        .catch((error: { statusCode?: number }) => {
          console.error("[push send]", error?.statusCode);
        }),
    ),
  );
}
