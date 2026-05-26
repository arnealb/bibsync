import { ACHIEVEMENT_BY_ID } from "@/lib/bibcoins/achievements";
import { awardBibcoins } from "@/lib/bibcoins/award";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Unlocks an achievement once and pays out its reward. Server-only; safe to
 * call on every relevant event — duplicates are ignored. No-ops without the
 * service key.
 */
export async function unlockAchievement(
  userId: string,
  achievementId: string,
): Promise<boolean> {
  const def = ACHIEVEMENT_BY_ID.get(achievementId);
  if (!def) return false;

  const admin = createAdminClient();
  if (!admin) return false;

  const { error } = await admin
    .from("user_achievements")
    .insert({ user_id: userId, achievement_id: achievementId });

  if (error) {
    if (error.code !== "23505") {
      console.error("[unlockAchievement]", achievementId, error);
    }
    return false; // already unlocked (23505) or failed
  }

  await awardBibcoins(userId, def.reward, "achievement", achievementId);
  return true;
}
