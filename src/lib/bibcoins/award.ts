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
