import { BIBCOINS_START } from "@/lib/bibcoins/config";
import { createClient } from "@/lib/supabase/server";

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
