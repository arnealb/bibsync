import { INSTANT_BREAK_WINDOW_SECONDS } from "@/lib/instant-break/config";
import { isBreakActive } from "@/lib/instant-break/status";
import { createClient } from "@/lib/supabase/server";
import type { InstantBreak, InstantBreakPush } from "@/types/database";

/** The room's currently-running instant break, or null if none is active. */
export async function getActiveInstantBreak(
  roomId: string,
): Promise<InstantBreak | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("instant_breaks")
    .select("*")
    .eq("room_id", roomId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return isBreakActive(data, Date.now()) ? data : null;
}

/** Presses within the rolling window — used to show "x/y wil pauze". */
export async function getRecentPushes(
  roomId: string,
): Promise<InstantBreakPush[]> {
  const supabase = await createClient();
  const cutoff = new Date(
    Date.now() - INSTANT_BREAK_WINDOW_SECONDS * 1000,
  ).toISOString();
  const { data } = await supabase
    .from("instant_break_pushes")
    .select("*")
    .eq("room_id", roomId)
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false });
  return data ?? [];
}
