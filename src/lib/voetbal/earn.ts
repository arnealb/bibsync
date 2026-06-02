import type { SupabaseClient } from "@supabase/supabase-js";

import { awardBibcoins } from "@/lib/bibcoins/award";
import { cappedCoins } from "@/lib/games/arcade-coins";
import { hourStartMs } from "@/lib/games/arcade-window";
import { VOETBAL_HOURLY_CAP, VOETBAL_REASON } from "@/lib/voetbal/config";

/**
 * Shared voetbal earning helpers (server-only). All voetbal modes draw from one
 * per-hour ledger pool (reason `voetbal`), so no single mode can be farmed past
 * the cap. Idempotent per `ref`.
 */

/** Coins this user earned from voetbal in the current clock hour. */
export async function voetbalEarnedThisHour(
  admin: SupabaseClient,
  userId: string,
): Promise<number> {
  const sinceIso = new Date(hourStartMs(Date.now())).toISOString();
  const { data } = await admin
    .from("bibcoin_transactions")
    .select("amount")
    .eq("user_id", userId)
    .eq("reason", VOETBAL_REASON)
    .gte("created_at", sinceIso);
  return (data ?? []).reduce(
    (sum: number, row: { amount: number }) => sum + row.amount,
    0,
  );
}

/**
 * Award up to `desired` coins for `ref`, clamped to the remaining hourly pool.
 * Returns the coins actually granted plus the resulting hour total.
 */
export async function awardVoetbalCapped(
  admin: SupabaseClient,
  userId: string,
  desired: number,
  ref: string,
): Promise<{ coins: number; hourEarned: number }> {
  const earned = await voetbalEarnedThisHour(admin, userId);
  const coins = cappedCoins(desired, earned, VOETBAL_HOURLY_CAP);
  let granted = 0;
  if (coins > 0) {
    const ok = await awardBibcoins(userId, coins, VOETBAL_REASON, ref);
    if (ok) granted = coins;
  }
  return { coins: granted, hourEarned: earned + granted };
}
