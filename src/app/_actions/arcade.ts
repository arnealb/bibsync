"use server";

import { ARCADE_REASONS, hourStartMs } from "@/lib/games/arcade-window";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * The caller's total skill-game coins earned in the current clock hour, for the
 * cap status bar. Global per user (arcade earnings aren't room-scoped). Uses the
 * same window as `earnFromArcade`, so the bar and the cap always agree.
 */
export async function getArcadeHourEarned(): Promise<number> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  const admin = createAdminClient();
  if (!admin) return 0;

  const sinceIso = new Date(hourStartMs(Date.now())).toISOString();
  const { data, error } = await admin
    .from("bibcoin_transactions")
    .select("amount")
    .eq("user_id", user.id)
    .in("reason", ARCADE_REASONS as unknown as string[])
    .gte("created_at", sinceIso);
  if (error) {
    console.error("[getArcadeHourEarned]", error);
    return 0;
  }
  return (data ?? []).reduce(
    (sum: number, row: { amount: number }) => sum + row.amount,
    0,
  );
}
