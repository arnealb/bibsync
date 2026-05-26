import {
  toPublicBlackjack,
  type BlackjackState,
  type PublicBlackjack,
} from "@/lib/blackjack/engine";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The current user's masked blackjack state (or null). Reads via the service
 * role since the table is not client-readable; returns only the public view.
 */
export async function getBlackjackPublic(
  userId: string,
): Promise<PublicBlackjack | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data, error } = await admin
    .from("blackjack_games")
    .select("state")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;

  const state = data.state as unknown as BlackjackState;
  // Ignore an empty / older-shape state so the page shows a fresh bet form.
  if (!Array.isArray(state.hands)) return null;
  return toPublicBlackjack(state);
}
