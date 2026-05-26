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

/** Credit the +5/hour passive trickle (capped). Returns the amount granted. */
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
