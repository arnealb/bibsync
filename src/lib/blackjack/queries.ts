import type { PublicTable } from "@/lib/blackjack/table";
import { createClient } from "@/lib/supabase/server";

/**
 * The room's public blackjack table (masked: no deck, dealer hole hidden until
 * the dealer plays). Uses the user-session client, so RLS requires membership.
 * Returns null when no table exists yet (created on first join).
 */
export async function getBlackjackTable(
  roomId: string,
): Promise<PublicTable | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("blackjack_tables")
    .select("state")
    .eq("room_id", roomId)
    .maybeSingle();

  if (error) {
    console.error("[getBlackjackTable]", error);
    return null;
  }
  if (!data) return null;

  const state = data.state as unknown as PublicTable;
  return Array.isArray(state.seats) ? state : null;
}
