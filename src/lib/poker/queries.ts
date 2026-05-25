import type { Card } from "@/lib/poker/cards";
import type { PublicState } from "@/lib/poker/engine";
import { createClient } from "@/lib/supabase/server";

/** The public poker state for a room, or null when no table exists yet. */
export async function getPokerTable(
  roomId: string,
): Promise<PublicState | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("poker_tables")
    .select("state")
    .eq("room_id", roomId)
    .maybeSingle();
  if (!data) return null;
  return data.state as unknown as PublicState;
}

/** The current user's two hole cards for the given hand, if dealt. */
export async function getMyHoleCards(
  roomId: string,
  handNo: number,
  userId: string,
): Promise<Card[] | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("poker_hole_cards")
    .select("cards")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .eq("hand_no", handNo)
    .maybeSingle();
  if (!data) return null;
  return data.cards as Card[];
}
