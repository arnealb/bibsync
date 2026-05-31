import { createClient } from "@/lib/supabase/server";
import type { ServiceBid, ServiceOffer } from "@/types/database";

/** Every offer in a room (newest first). RLS scopes this to members. */
export async function getRoomOffers(roomId: string): Promise<ServiceOffer[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("service_offers")
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[getRoomOffers]", error);
    return [];
  }
  return data ?? [];
}

/** Every bid in a room (cheapest first), for the request offers. */
export async function getRoomBids(roomId: string): Promise<ServiceBid[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("service_bids")
    .select("*")
    .eq("room_id", roomId)
    .order("price", { ascending: true });

  if (error) {
    console.error("[getRoomBids]", error);
    return [];
  }
  return data ?? [];
}
