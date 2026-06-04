import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Server-only bibcoin mutations. These call SECURITY DEFINER functions that
 * are revoked from normal users, so they MUST run with the service-role key
 * and only after the caller has been authenticated/authorised. Never import
 * into a client component.
 *
 * All degrade to a no-op when the secret key is missing (local dev without it).
 */

/** Grant `amount` once for (reason, ref). Returns true if newly granted. */
export async function awardBibcoins(
  userId: string,
  amount: number,
  reason: string,
  ref = "",
): Promise<boolean> {
  const admin = createAdminClient();
  if (!admin) return false;
  const { data, error } = await admin.rpc("award_bibcoins", {
    _user_id: userId,
    _amount: amount,
    _reason: reason,
    _ref: ref,
  });
  if (error) {
    console.error("[awardBibcoins]", reason, error);
    return false;
  }
  return data === true;
}

/** Deduct `amount` if the balance allows it. Returns true on success. */
export async function spendBibcoins(
  userId: string,
  amount: number,
  reason: string,
  ref = "",
): Promise<boolean> {
  const admin = createAdminClient();
  if (!admin) return false;
  const { data, error } = await admin.rpc("spend_bibcoins", {
    _user_id: userId,
    _amount: amount,
    _reason: reason,
    _ref: ref,
  });
  if (error) {
    console.error("[spendBibcoins]", reason, error);
    return false;
  }
  return data === true;
}

/**
 * Put a user in (deeper) debt: half of their future income is garnished until
 * the debt is repaid (migration 0061). Used for the uncovered part of a
 * caught-thief penalty.
 */
export async function addWalletDebt(
  userId: string,
  amount: number,
): Promise<void> {
  if (amount <= 0) return;
  const admin = createAdminClient();
  if (!admin) return;
  const { error } = await admin.rpc("add_wallet_debt", {
    _user_id: userId,
    _amount: amount,
  });
  if (error) console.error("[addWalletDebt]", error);
}

/**
 * Atomically move `amount` bibcoins from one user to another. Returns true on
 * success, false if the sender can't afford it or the transfer was already
 * processed for this `ref`. No-op without the service key.
 */
export async function transferBibcoins(
  senderId: string,
  recipientId: string,
  amount: number,
  ref: string,
): Promise<boolean> {
  const admin = createAdminClient();
  if (!admin) return false;
  const { data, error } = await admin.rpc("transfer_bibcoins", {
    _sender: senderId,
    _recipient: recipientId,
    _amount: amount,
    _ref: ref,
  });
  if (error) {
    console.error("[transferBibcoins]", error);
    return false;
  }
  return data === true;
}

/** Credit the hourly passive trickle (capped). Returns the amount granted. */
export async function claimHourlyBibcoins(userId: string): Promise<number> {
  const admin = createAdminClient();
  if (!admin) return 0;
  const { data, error } = await admin.rpc("claim_hourly_bibcoins", {
    _user_id: userId,
  });
  if (error) {
    console.error("[claimHourlyBibcoins]", error);
    return 0;
  }
  return typeof data === "number" ? data : 0;
}

/**
 * Record a screen-time heartbeat and credit any newly earned daily reward.
 * The RPC only counts real wall-clock time since the previous beat (capped),
 * so it is safe to call on a fixed interval. Returns today's total seconds and
 * the coins just granted (both 0 without the service key).
 */
export async function recordScreenTime(
  userId: string,
  resume = false,
): Promise<{ totalSeconds: number; coinsEarned: number }> {
  const admin = createAdminClient();
  if (!admin) return { totalSeconds: 0, coinsEarned: 0 };
  const { data, error } = await admin.rpc("record_screen_time", {
    _user_id: userId,
    _resume: resume,
  });
  if (error) {
    console.error("[recordScreenTime]", error);
    return { totalSeconds: 0, coinsEarned: 0 };
  }
  const row = data?.[0];
  return {
    totalSeconds: row?.total_seconds ?? 0,
    coinsEarned: row?.coins_earned ?? 0,
  };
}

/** Credit the night-owl "Strijder" bonus (00:30–01:30 Brussels). Returns the
 *  amount granted (0 outside the window or already claimed today). */
export async function claimStrijderBonus(userId: string): Promise<number> {
  const admin = createAdminClient();
  if (!admin) return 0;
  const { data, error } = await admin.rpc("claim_strijder_bonus", {
    _user_id: userId,
  });
  if (error) {
    console.error("[claimStrijderBonus]", error);
    return 0;
  }
  return typeof data === "number" ? data : 0;
}

/** Credit the once-a-day login bonus. Returns the amount granted (0 if already claimed today). */
export async function claimDailyBibcoins(userId: string): Promise<number> {
  const admin = createAdminClient();
  if (!admin) return 0;
  const { data, error } = await admin.rpc("claim_daily_bibcoins", {
    _user_id: userId,
  });
  if (error) {
    console.error("[claimDailyBibcoins]", error);
    return 0;
  }
  return typeof data === "number" ? data : 0;
}
