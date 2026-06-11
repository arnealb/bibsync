"use server";

import { getBibcoins } from "@/lib/bibcoins/queries";
import { copy } from "@/lib/copy";
import { getHorsesState, type HorsesState } from "@/lib/horses/queries";
import { requireRoomAccess } from "@/lib/rooms/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  placeHorseBetSchema,
  type PlaceHorseBetInput,
} from "@/lib/validation/horses";

export type PlaceHorseBetResult =
  | { ok: true; balance: number }
  | { ok: false; error: string };

/**
 * Stake a bet on a horse. The SQL function locks the race row, so a bet and
 * the hourly resolver serialise — a bet can never slip in after the winner
 * has been drawn.
 */
export async function placeHorseBet(
  input: PlaceHorseBetInput,
): Promise<PlaceHorseBetResult> {
  const parsed = placeHorseBetSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: copy.common.genericError };
  const { roomId, raceId, horseIdx, amount } = parsed.data;

  const access = await requireRoomAccess(roomId);
  if (!access) return { ok: false, error: copy.common.notAuthenticated };
  if (access.isPilloried) return { ok: false, error: copy.pillory.frozen };

  const admin = createAdminClient();
  if (!admin) return { ok: false, error: copy.horses.unavailable };

  const { data, error } = await admin.rpc("place_horse_bet", {
    _user_id: access.userId,
    _race_id: raceId,
    _horse_idx: horseIdx,
    _amount: amount,
  });
  if (error) {
    console.error("[placeHorseBet]", raceId, error);
    return { ok: false, error: copy.horses.unavailable };
  }

  if (data === "broke") return { ok: false, error: copy.horses.cantAfford };
  if (data === "closed") return { ok: false, error: copy.horses.raceClosed };
  if (data !== "ok") return { ok: false, error: copy.common.genericError };

  return { ok: true, balance: await getBibcoins(access.userId) };
}

export type HorsesViewResult =
  | { ok: true; state: HorsesState }
  | { ok: false; error: string };

/** Fresh racebook snapshot — the client refetches this on realtime events. */
export async function getHorsesView(roomId: string): Promise<HorsesViewResult> {
  const access = await requireRoomAccess(roomId);
  if (!access) return { ok: false, error: copy.common.notAuthenticated };
  return { ok: true, state: await getHorsesState(access.userId) };
}
