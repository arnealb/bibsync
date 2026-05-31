import { BIBCOINS_START } from "@/lib/bibcoins/config";
import { getRoomMembers } from "@/lib/rooms/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import type { ResolvedLoadout } from "@/lib/cosmetics/resolve";

export interface WealthEntry {
  userId: string;
  name: string;
  avatarUrl: string | null;
  loadout: ResolvedLoadout | null;
  bibcoins: number;
}

/**
 * Room members ranked by bibcoins balance (richest first). Uses the service
 * role for the balances since `wallets` RLS only exposes your own row.
 */
export async function getRoomWealth(roomId: string): Promise<WealthEntry[]> {
  const members = await getRoomMembers(roomId);
  if (members.length === 0) return [];

  const admin = createAdminClient();
  const balances = new Map<string, number>();
  if (admin) {
    const { data } = await admin
      .from("wallets")
      .select("user_id, bibcoins")
      .in(
        "user_id",
        members.map((m) => m.user_id),
      );
    for (const row of data ?? []) balances.set(row.user_id, row.bibcoins);
  }

  return members
    .map((m) => ({
      userId: m.user_id,
      name: m.profile?.display_name ?? "—",
      avatarUrl: m.profile?.avatar_url ?? null,
      loadout: m.loadout,
      bibcoins: balances.get(m.user_id) ?? BIBCOINS_START,
    }))
    .sort((a, b) => b.bibcoins - a.bibcoins);
}

/** The current user's bibcoins balance (starting value if no wallet yet). */
export async function getBibcoins(userId: string): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("wallets")
    .select("bibcoins")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.bibcoins ?? BIBCOINS_START;
}

/** Ids of achievements the user has unlocked. */
export async function getUnlockedAchievements(
  userId: string,
): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_achievements")
    .select("achievement_id")
    .eq("user_id", userId);
  return (data ?? []).map((row) => row.achievement_id);
}
