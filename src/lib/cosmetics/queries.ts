import { createClient } from "@/lib/supabase/server";
import type { UserLoadout } from "@/types/database";

/** Item ids the current user owns. */
export async function getOwnedCosmetics(userId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_cosmetics")
    .select("item_id")
    .eq("user_id", userId);
  return (data ?? []).map((row) => row.item_id);
}

/** A single user's equipped loadout (null if none set). */
export async function getLoadout(userId: string): Promise<UserLoadout | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_loadout")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  return data;
}

/** Equipped loadouts for many users, keyed by user id (for presence/lists). */
export async function getLoadouts(
  userIds: string[],
): Promise<Record<string, UserLoadout>> {
  if (userIds.length === 0) return {};
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_loadout")
    .select("*")
    .in("user_id", userIds);
  const map: Record<string, UserLoadout> = {};
  for (const row of data ?? []) map[row.user_id] = row;
  return map;
}
