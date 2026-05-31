import type { LotteryState } from "@/lib/lottery/engine";
import { createClient } from "@/lib/supabase/server";

/** The room's current lottery round (null if none yet). Member-scoped by RLS. */
export async function getLotteryRound(
  roomId: string,
): Promise<LotteryState | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lottery_rounds")
    .select("state")
    .eq("room_id", roomId)
    .maybeSingle();

  if (error) {
    console.error("[getLotteryRound]", error);
    return null;
  }
  if (!data) return null;
  const state = data.state as unknown as LotteryState;
  return Array.isArray(state.tickets) ? state : null;
}
