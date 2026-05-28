import { BIBCOINS_START } from "@/lib/bibcoins/config";
import { createClient } from "@/lib/supabase/server";

export interface ProfileStats {
  bibcoins: number;
  proposals: number;
  comments: number;
  messages: number;
}

/** A user's public stats: balance + lifetime activity counts (global totals). */
export async function getProfileStats(userId: string): Promise<ProfileStats> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_profile_stats", {
    _user_id: userId,
  });
  const row = data?.[0];
  return {
    bibcoins: row?.bibcoins ?? BIBCOINS_START,
    proposals: Number(row?.proposals ?? 0),
    comments: Number(row?.comments ?? 0),
    messages: Number(row?.messages ?? 0),
  };
}
