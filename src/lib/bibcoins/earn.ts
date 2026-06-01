import { awardBibcoins } from "@/lib/bibcoins/award";
import {
  DAILY_CHAT_THRESHOLD,
  REWARD,
  STEPS_REWARD_DAILY_CAP_THOUSANDS,
} from "@/lib/bibcoins/config";
import { unlockAchievement } from "@/lib/bibcoins/unlock";
import { dayTotal } from "@/lib/steps/aggregate";
import { createAdminClient } from "@/lib/supabase/admin";
import { todayInBrussels } from "@/lib/time";

/**
 * Earning hooks. All server-only, idempotent, and abuse-resistant:
 * rewards are keyed so they pay out once. No-op without the service key.
 */

/** First vote on a proposal pays out once — switching vote earns nothing. */
export async function earnFromVote(
  userId: string,
  itemId: string,
): Promise<void> {
  await awardBibcoins(userId, REWARD.vote, "vote", itemId);
  await unlockAchievement(userId, "first_vote");
}

/**
 * Proposing a break pays out once per (room, day) — keyed on the day, not the
 * proposal, so making 100 proposals still earns the reward only once. Free
 * proposals and slot preferences share the key, so they can't both pay out.
 */
export async function earnFromProposal(
  userId: string,
  roomId: string,
): Promise<void> {
  await awardBibcoins(
    userId,
    REWARD.createProposal,
    "proposal",
    `${roomId}:${todayInBrussels()}`,
  );
}

/** Commenting on a proposal pays out once per (room, day), not per comment. */
export async function earnFromComment(
  userId: string,
  roomId: string,
): Promise<void> {
  await awardBibcoins(
    userId,
    REWARD.comment,
    "comment",
    `${roomId}:${todayInBrussels()}`,
  );
}

/** First message ever, and the once-a-day "20 messages" reward. */
export async function earnFromMessage(userId: string): Promise<void> {
  await unlockAchievement(userId, "first_message");

  const admin = createAdminClient();
  if (!admin) return;

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from("messages")
    .select("*", { count: "exact", head: true })
    .eq("author_id", userId)
    .gte("created_at", since);

  if ((count ?? 0) >= DAILY_CHAT_THRESHOLD) {
    const granted = await awardBibcoins(
      userId,
      REWARD.dailyChat,
      "daily_chat",
      todayInBrussels(),
    );
    if (granted) await unlockAchievement(userId, "chatterbox");
  }
}

/** Honest Snake runs pay out up to your all-time best (cheated runs earn nothing). */
export async function earnFromSnake(
  userId: string,
  score: number,
  cheated: boolean,
): Promise<void> {
  if (cheated || score <= 0) return;

  const admin = createAdminClient();
  if (!admin) return;

  const { data } = await admin
    .from("bibcoin_transactions")
    .select("amount")
    .eq("user_id", userId)
    .eq("reason", "snake_best");
  const alreadyAwarded = (data ?? []).reduce(
    (sum: number, row: { amount: number }) => sum + row.amount,
    0,
  );

  const delta = (score - alreadyAwarded) * REWARD.snakeBestPerPoint;
  if (delta > 0) {
    await awardBibcoins(userId, delta, "snake_best", String(score));
  }

  if (score >= 25) await unlockAchievement(userId, "snake_25");
  if (score >= 100) await unlockAchievement(userId, "snake_100");
}

/** Flappy Bird runs pay out 10 per point, up to your all-time best (no farming). */
export async function earnFromFlappy(
  userId: string,
  score: number,
): Promise<void> {
  if (score <= 0) return;

  const admin = createAdminClient();
  if (!admin) return;

  const { data } = await admin
    .from("bibcoin_transactions")
    .select("amount")
    .eq("user_id", userId)
    .eq("reason", "flappy_best");
  const alreadyAwarded = (data ?? []).reduce(
    (sum: number, row: { amount: number }) => sum + row.amount,
    0,
  );

  const delta = score * REWARD.flappyBestPerPoint - alreadyAwarded;
  if (delta > 0) {
    await awardBibcoins(userId, delta, "flappy_best", String(score));
  }
}

/** Clearing a Pet Connect board: a once-a-day coin reward + achievement. */
export async function earnFromPetConnect(userId: string): Promise<void> {
  await unlockAchievement(userId, "petconnect_clear");
  await awardBibcoins(
    userId,
    REWARD.petConnectDaily,
    "petconnect_daily",
    todayInBrussels(),
  );
}

/**
 * Steps walked during breaks earn bibcoins per full 1000 of the user's *daily*
 * total (summed across rooms), capped per day. Idempotent: each 1000-step
 * milestone pays out once, so calling this after every saved session is safe.
 */
export async function earnFromSteps(userId: string): Promise<void> {
  await unlockAchievement(userId, "first_steps");

  const admin = createAdminClient();
  if (!admin) return;

  const today = todayInBrussels();
  const { data } = await admin
    .from("step_sessions")
    .select("steps, source")
    .eq("user_id", userId)
    .eq("recorded_for", today);

  // Health rows carry the running daily total (take the max), browser rows are
  // increments (sum) — never just add them up, or a daily total double-counts.
  const totalToday = dayTotal(data ?? []);
  if (totalToday >= 10_000) await unlockAchievement(userId, "step_master");

  const milestones = Math.min(
    Math.floor(totalToday / 1000),
    STEPS_REWARD_DAILY_CAP_THOUSANDS,
  );
  for (let k = 1; k <= milestones; k++) {
    await awardBibcoins(userId, REWARD.stepsPer1000, "steps", `${today}:${k}`);
  }
}
