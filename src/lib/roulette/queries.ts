import type { RouletteTable } from "@/lib/roulette/table";
import { createClient } from "@/lib/supabase/server";

/**
 * The room's shared roulette table. Uses the user-session client, so RLS
 * requires membership. Returns null when no table exists yet.
 */
export async function getRouletteTable(
  roomId: string,
): Promise<RouletteTable | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("roulette_tables")
    .select("state")
    .eq("room_id", roomId)
    .maybeSingle();

  if (error) {
    console.error("[getRouletteTable]", error);
    return null;
  }
  if (!data) return null;

  const state = data.state as unknown as RouletteTable;
  return Array.isArray(state.bets) ? state : null;
}
