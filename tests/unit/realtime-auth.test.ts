import { describe, expect, it, vi } from "vitest";

import type { SupabaseClient } from "@supabase/supabase-js";

import { ensureRealtimeAuth } from "@/lib/supabase/realtime-auth";

/**
 * Minimal stand-in for the browser Supabase client: just the two surfaces
 * `ensureRealtimeAuth` touches, with spies so we can assert what it pushed.
 */
function fakeClient(session: { access_token: string } | null) {
  const setAuth = vi.fn(async () => {});
  const getSession = vi.fn(async () => ({ data: { session } }));
  const client = {
    auth: { getSession },
    realtime: { setAuth },
  } as unknown as SupabaseClient;
  return { client, setAuth, getSession };
}

describe("ensureRealtimeAuth", () => {
  it("pushes the signed-in user's access token onto the realtime socket", async () => {
    const { client, setAuth, getSession } = fakeClient({
      access_token: "jwt-123",
    });

    await ensureRealtimeAuth(client);

    expect(getSession).toHaveBeenCalledOnce();
    expect(setAuth).toHaveBeenCalledWith("jwt-123");
  });

  it("does nothing when there is no session (anonymous socket stays as-is)", async () => {
    const { client, setAuth } = fakeClient(null);

    await ensureRealtimeAuth(client);

    expect(setAuth).not.toHaveBeenCalled();
  });
});
