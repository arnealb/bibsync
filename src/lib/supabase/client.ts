import { createBrowserClient } from "@supabase/ssr";

import { env } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Supabase client for use in Client Components (browser).
 *
 * Uses the new publishable key naming (`sb_publishable_*`), which is a drop-in
 * replacement for the legacy anon key.
 */
export function createClient() {
  return createBrowserClient<Database>(
    env.supabaseUrl,
    env.supabasePublishableKey,
  );
}
