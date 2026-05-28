"use server";

import { claimDailyBibcoins, claimHourlyBibcoins } from "@/lib/bibcoins/award";
import { getAuthContext } from "@/lib/auth";

type ClaimResult = { ok: true; granted: number } | { ok: false };

/** Credits the hourly passive trickle for the current user. */
export async function claimHourly(): Promise<ClaimResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { ok: false };
  const granted = await claimHourlyBibcoins(ctx.user.id);
  return { ok: true, granted };
}

/** Credits the once-a-day login bonus for the current user. */
export async function claimDaily(): Promise<ClaimResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { ok: false };
  const granted = await claimDailyBibcoins(ctx.user.id);
  return { ok: true, granted };
}
