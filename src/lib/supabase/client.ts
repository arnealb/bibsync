import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";
import type { Database } from "@/types/database";

let browserClient: SupabaseClient<Database> | undefined;

/**
 * Supabase client for use in Client Components (browser).
 *
 * Returns a single shared instance so every realtime hook multiplexes one
 * authenticated WebSocket instead of opening (and racing the auth handshake
 * on) a fresh connection each time.
 *
 * Uses the new publishable key naming (`sb_publishable_*`), a drop-in
 * replacement for the legacy anon key.
 */
export function createClient() {
  if (browserClient) return browserClient;

  browserClient = createBrowserClient<Database>(
    env.supabaseUrl,
    env.supabasePublishableKey,
  );

  // Realtime delivers RLS-protected postgres_changes only when the socket
  // carries the user's JWT. Without it the connection is anonymous and the
  // subscription silently receives nothing (so changes appear only after a
  // refresh). Push the token as soon as the session is known, and again
  // whenever it refreshes.
  const client = browserClient;
  void client.auth.getSession().then(({ data }) => {
    if (data.session) void client.realtime.setAuth(data.session.access_token);
  });
  client.auth.onAuthStateChange((_event, session) => {
    void client.realtime.setAuth(session?.access_token ?? null);
  });

  return browserClient;
}
