import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Push the signed-in user's JWT onto the realtime socket and wait for it to
 * land — call this and `await` it BEFORE opening any RLS-scoped channel.
 *
 * Realtime authorises a channel's `postgres_changes` binding at JOIN time using
 * whatever token is on the socket right then. The browser client sets that
 * token asynchronously (after `auth.getSession()` resolves), so a channel that
 * subscribes during a cold page load can join *before* the token arrives. The
 * binding is then created under the anonymous role and every RLS-scoped event
 * is silently dropped — e.g. the header `wallets` balance only refreshing on a
 * full reload. Awaiting this first closes that race.
 *
 * No-op when there's no session (an anonymous socket has nothing to authorise).
 */
export async function ensureRealtimeAuth(
  client: SupabaseClient,
): Promise<void> {
  const { data } = await client.auth.getSession();
  if (data.session) await client.realtime.setAuth(data.session.access_token);
}
