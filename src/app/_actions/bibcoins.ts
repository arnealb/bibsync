"use server";

import { claimHourlyBibcoins } from "@/lib/bibcoins/award";
import { getAuthContext } from "@/lib/auth";

type ClaimResult = { ok: true; granted: number } | { ok: false };

/** Credits the +5/hour passive trickle for the current user. */
export async function claimHourly(): Promise<ClaimResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { ok: false };
  const granted = await claimHourlyBibcoins(ctx.user.id);
  return { ok: true, granted };
}
