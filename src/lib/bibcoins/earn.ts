import { awardBibcoins } from "@/lib/bibcoins/award";
import {
  ARCADE_HOURLY_CAP,
  DAILY_CHAT_THRESHOLD,
  REWARD,
  STEPS_REWARD_DAILY_CAP_THOUSANDS,
} from "@/lib/bibcoins/config";
import { unlockAchievement } from "@/lib/bibcoins/unlock";
import { arcadeCoins, cappedCoins } from "@/lib/games/arcade-coins";
import { CAPPED_EARN_REASONS, hourStartMs } from "@/lib/games/arcade-window";
import type { GameKey } from "@/lib/validation/games";
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

/**
 * A finished per-event skill run (snake/flappy/tetris/2048) pays the per-game
 * `arcadeCoins` amount, clamped so these four games together pay at most
 * ARCADE_HOURLY_CAP in the current clock hour. A fresh server-side ref means
 * every run can pay (the cap, not idempotency, governs the total). Cheated
 * (autopilot) runs earn nothing; Snake keeps its score achievements.
 */
export async function earnFromArcade(
  userId: string,
  gameKey: GameKey,
  score: number,
  cheated: boolean,
): Promise<void> {
  if (cheated || score <= 0) return;

  if (gameKey === "snake") {
    if (score >= 25) await unlockAchievement(userId, "snake_25");
    if (score >= 100) await unlockAchievement(userId, "snake_100");
  }

  const desired = arcadeCoins(gameKey, score);
  if (desired <= 0) return;

  const admin = createAdminClient();
  if (!admin) return;

  const coins = cappedCoins(
    desired,
    await cappedEarnedThisHour(admin, userId),
    ARCADE_HOURLY_CAP,
  );
  if (coins > 0) {
    await awardBibcoins(userId, coins, gameKey, crypto.randomUUID());
  }
}

/** Coins earned this clock hour across all reasons sharing the arcade cap. */
async function cappedEarnedThisHour(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<number> {
  if (!admin) return 0;
  const sinceIso = new Date(hourStartMs(Date.now())).toISOString();
  const { data } = await admin
    .from("bibcoin_transactions")
    .select("amount")
    .eq("user_id", userId)
    .in("reason", CAPPED_EARN_REASONS as unknown as string[])
    .gte("created_at", sinceIso);
  return (data ?? []).reduce(
    (sum: number, row: { amount: number }) => sum + row.amount,
    0,
  );
}

/**
 * Pay a Merge Valley order reward, clamped to the shared arcade hourly cap so
 * it can't be farmed. Returns the coins actually awarded (0 if capped out).
 * Idempotent per `ref` (the delivered order id).
 */
export async function earnFromMergeOrder(
  userId: string,
  reward: number,
  ref: string,
): Promise<number> {
  if (reward <= 0) return 0;
  const admin = createAdminClient();
  if (!admin) return 0;

  const coins = cappedCoins(
    reward,
    await cappedEarnedThisHour(admin, userId),
    ARCADE_HOURLY_CAP,
  );
  if (coins > 0) {
    await awardBibcoins(userId, coins, "merge_order", ref);
  }
  return coins;
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
