import { DAILY_QUESTS, type QuestDef } from "@/lib/quests/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { todayInBrussels } from "@/lib/time";

export interface QuestState {
  def: QuestDef;
  progress: number;
  claimed: boolean;
}

/** Today's quest progress + claimed state for a user (server-side). */
export async function getDailyQuests(userId: string): Promise<QuestState[]> {
  const admin = createAdminClient();
  if (!admin) {
    return DAILY_QUESTS.map((def) => ({ def, progress: 0, claimed: false }));
  }

  const today = todayInBrussels();
  const [{ data: metrics }, { data: claims }] = await Promise.all([
    admin.rpc("daily_quest_metrics", { _user_id: userId }),
    admin
      .from("bibcoin_transactions")
      .select("ref_key")
      .eq("user_id", userId)
      .eq("reason", "quest")
      .like("ref_key", `${today}:%`),
  ]);

  const counts = (metrics ?? {}) as Record<string, number>;
  const claimedKeys = new Set(
    (claims ?? []).map((c) => c.ref_key.split(":")[1]),
  );

  return DAILY_QUESTS.map((def) => ({
    def,
    progress: Number(counts[def.metric] ?? 0),
    claimed: claimedKeys.has(def.key),
  }));
}

/** The user's current login streak (0 if never claimed). */
export async function getDailyStreak(userId: string): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("wallets")
    .select("daily_streak, last_daily_on")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data?.last_daily_on) return data?.daily_streak ?? 0;
  // A missed day means the stored streak is stale until the next claim.
  const today = todayInBrussels();
  const isFresh =
    data.last_daily_on === today || data.last_daily_on >= yesterday(today);
  return isFresh ? data.daily_streak : 0;
}

/** Yesterday's ISO date relative to a Brussels `today` (string compare safe). */
function yesterday(today: string): string {
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
