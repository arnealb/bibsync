import { createClient } from "@/lib/supabase/server";

export interface PendingTheft {
  id: string;
  amount: number;
  createdAt: string;
}

/**
 * Open thefts against the signed-in user (RLS-scoped to the victim). These drive
 * the "je bent bestolen" banner; whether each is still claimable (no spend
 * since) is decided server-side at claim time.
 */
export async function getMyPendingThefts(
  userId: string,
): Promise<PendingTheft[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("thefts")
    .select("id, amount, created_at")
    .eq("victim_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[getMyPendingThefts]", error);
    return [];
  }
  return (data ?? []).map((r) => ({
    id: r.id,
    amount: r.amount,
    createdAt: r.created_at,
  }));
}
