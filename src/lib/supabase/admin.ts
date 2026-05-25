import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client. Bypasses RLS, so it must ONLY be used in
 * server-side code (Server Actions / Route Handlers) that has already done its
 * own authorization checks. Never import this into a client component.
 *
 * Returns null when the secret key is not configured (e.g. local dev without
 * it) so callers can degrade gracefully instead of crashing.
 */
export function createAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) return null;
  return createClient(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
