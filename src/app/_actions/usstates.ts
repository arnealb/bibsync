"use server";

import { awardBibcoins } from "@/lib/bibcoins/award";
import { getBibcoins } from "@/lib/bibcoins/queries";
import { copy } from "@/lib/copy";
import { requireRoomAccess } from "@/lib/rooms/queries";
import { todayInBrussels } from "@/lib/time";
import { USSTATES_COINS_PER_STATE } from "@/lib/usstates/config";
import {
  claimStateCoinSchema,
  type ClaimStateCoinInput,
} from "@/lib/validation/games";

export type ClaimStateCoinResult =
  | { ok: true; balance: number; awarded: boolean }
  | { ok: false; error: string };

/**
 * Award the per-state bibcoins for a correctly named state. The award is keyed
 * by (user, state, Brussels date), so the idempotent ledger pays each state at
 * most once per day — replaying or hammering this never exceeds the cap.
 */
export async function claimStateCoin(
  input: ClaimStateCoinInput,
): Promise<ClaimStateCoinResult> {
  const parsed = claimStateCoinSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: copy.common.genericError };

  const access = await requireRoomAccess(parsed.data.roomId);
  if (!access) return { ok: false, error: copy.common.notAuthenticated };

  const ref = `usstates:${access.userId}:${parsed.data.code}:${todayInBrussels()}`;
  const awarded = await awardBibcoins(
    access.userId,
    USSTATES_COINS_PER_STATE,
    "usstates",
    ref,
  );

  return { ok: true, awarded, balance: await getBibcoins(access.userId) };
}
