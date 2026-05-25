import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";

interface AuthContext {
  user: { id: string; email: string | null };
  profile: Profile | null;
}

/**
 * Loads the authenticated user and their profile for the current request.
 * Wrapped in `cache` so multiple calls within one render share the result.
 * Returns `null` when there is no session.
 */
export const getAuthContext = cache(
  async (): Promise<AuthContext | null> => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    return {
      user: { id: user.id, email: user.email ?? null },
      profile,
    };
  },
);

/** First letters of a display name, for avatar fallbacks. */
export function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
