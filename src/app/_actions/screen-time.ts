"use server";

import { recordScreenTime } from "@/lib/bibcoins/award";
import { getAuthContext } from "@/lib/auth";

export type ScreenTimeResult =
  | { ok: true; totalSeconds: number; coinsEarned: number }
  | { ok: false };

/**
 * Records a screen-time heartbeat for the current user. The server computes the
 * real elapsed time since the last beat, so the client can call this on a fixed
 * interval while the tab is visible without being able to inflate the total.
 */
export async function pingScreenTime(
  resume = false,
): Promise<ScreenTimeResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { ok: false };
  const { totalSeconds, coinsEarned } = await recordScreenTime(
    ctx.user.id,
    resume,
  );
  return { ok: true, totalSeconds, coinsEarned };
}
