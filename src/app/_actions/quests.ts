"use server";

import { getAuthContext } from "@/lib/auth";
import { copy } from "@/lib/copy";
import { DAILY_QUESTS } from "@/lib/quests/config";
import { createAdminClient } from "@/lib/supabase/admin";

export type ClaimQuestResult =
  | { ok: true; granted: number }
  | { ok: false; error: string };

/** Claim a daily quest reward (server re-checks the goal; idempotent per day). */
export async function claimQuest(key: string): Promise<ClaimQuestResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { ok: false, error: copy.common.notAuthenticated };

  const def = DAILY_QUESTS.find((q) => q.key === key);
  if (!def) return { ok: false, error: copy.common.genericError };

  const admin = createAdminClient();
  if (!admin) return { ok: false, error: copy.quests.unavailable };

  // Reward/required come from the trusted server catalogue, never the client.
  const { data, error } = await admin.rpc("claim_quest", {
    _user_id: ctx.user.id,
    _key: def.key,
    _metric: def.metric,
    _required: def.goal,
    _reward: def.reward,
  });
  if (error) {
    console.error("[claimQuest]", error);
    return { ok: false, error: copy.quests.error };
  }

  const granted = typeof data === "number" ? data : 0;
  if (granted <= 0) return { ok: false, error: copy.quests.notReady };
  return { ok: true, granted };
}
