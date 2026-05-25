"use server";

import { revalidatePath } from "next/cache";

import type { ActionResult } from "@/app/_actions/types";
import { copy } from "@/lib/copy";
import { createClient } from "@/lib/supabase/server";

interface SubscriptionInput {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export async function savePushSubscription(
  sub: SubscriptionInput,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: copy.common.notAuthenticated };

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      endpoint: sub.endpoint,
      user_id: user.id,
      p256dh: sub.p256dh,
      auth: sub.auth,
    },
    { onConflict: "endpoint" },
  );
  if (error) {
    console.error("[savePushSubscription]", error);
    return { ok: false, error: copy.push.error };
  }
  return { ok: true };
}

export async function removePushSubscription(
  endpoint: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint);
  if (error) {
    console.error("[removePushSubscription]", error);
    return { ok: false, error: copy.push.error };
  }
  return { ok: true };
}

export interface NotificationPrefs {
  notifyProposals: boolean;
  notifyFood: boolean;
  notifyChat: boolean;
  notifyComments: boolean;
  notifyVotes: boolean;
}

export async function updateNotificationPrefs(
  prefs: NotificationPrefs,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: copy.common.notAuthenticated };

  const { error } = await supabase
    .from("profiles")
    .update({
      notify_proposals: prefs.notifyProposals,
      notify_food: prefs.notifyFood,
      notify_chat: prefs.notifyChat,
      notify_comments: prefs.notifyComments,
      notify_votes: prefs.notifyVotes,
    })
    .eq("id", user.id);
  if (error) {
    console.error("[updateNotificationPrefs]", error);
    return { ok: false, error: copy.common.genericError };
  }
  revalidatePath("/app/profile");
  return { ok: true };
}
