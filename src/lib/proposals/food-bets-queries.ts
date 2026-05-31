import { createClient } from "@/lib/supabase/server";
import { isoDatePlus } from "@/lib/time";
import type { FoodPlaceBet } from "@/types/database";

/** Food-place bets for a room's upcoming days (today … +7). Member-scoped. */
export async function getFoodBets(roomId: string): Promise<FoodPlaceBet[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("food_place_bets")
    .select("*")
    .eq("room_id", roomId)
    .gte("slot_date", isoDatePlus(0))
    .lte("slot_date", isoDatePlus(7));

  if (error) {
    console.error("[getFoodBets]", error);
    return [];
  }
  return data ?? [];
}
