"use server";

import { spendBibcoins } from "@/lib/bibcoins/award";
import { copy } from "@/lib/copy";
import { isUserPresent } from "@/lib/presence/queries";
import { createClient } from "@/lib/supabase/server";
import {
  stakeFoodPlaceSchema,
  type StakeFoodPlaceInput,
} from "@/lib/validation/food-bets";
import type { FoodPlaceBet } from "@/types/database";

export type StakeFoodResult =
  | { ok: true; bet: FoodPlaceBet; balance: number }
  | { ok: false; error: string };

/** Stake bibcoins on an eating place for a lunch/dinner slot (coins are spent). */
export async function stakeFoodPlace(
  input: StakeFoodPlaceInput,
): Promise<StakeFoodResult> {
  const parsed = stakeFoodPlaceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: copy.common.genericError };
  const { roomId, slotDate, slotKey, place, amount } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: copy.common.notAuthenticated };

  if (!(await isUserPresent(roomId, user.id))) {
    return { ok: false, error: copy.proposals.validation.notPresent };
  }

  const ref = `food:${roomId}:${slotDate}:${slotKey}:${user.id}:${crypto.randomUUID()}`;
  const paid = await spendBibcoins(user.id, amount, "food_bet", ref);
  if (!paid) return { ok: false, error: copy.foodBets.cantAfford };

  const { data, error } = await supabase
    .from("food_place_bets")
    .insert({
      room_id: roomId,
      slot_date: slotDate,
      slot_key: slotKey,
      place,
      user_id: user.id,
      amount,
    })
    .select("*")
    .single();

  if (error || !data) {
    console.error("[stakeFoodPlace]", error);
    return { ok: false, error: copy.foodBets.error };
  }

  const { data: wallet } = await supabase
    .from("wallets")
    .select("bibcoins")
    .eq("user_id", user.id)
    .maybeSingle();

  return { ok: true, bet: data, balance: wallet?.bibcoins ?? 0 };
}
