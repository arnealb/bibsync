import { earnFromSteps } from "@/lib/bibcoins/earn";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  apiStepsSchema,
  resolveStepCredentials,
} from "@/lib/validation/steps";

/**
 * Apple Shortcut → BibSync step ingest.
 *
 * An Apple Shortcut reads the user's daily step count from Health and POSTs
 * `{ token, roomId, steps }` here. The per-user token (see /app/rooms/[id]/
 * stappen) authenticates the request; the token's owner must belong to the
 * target room. Runs entirely with the service role.
 */
export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const parsed = apiStepsSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { ok: false, error: "invalid_input" },
      { status: 400 },
    );
  }

  const credentials = resolveStepCredentials(parsed.data);
  if (!credentials) {
    return Response.json(
      { ok: false, error: "invalid_credentials" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  if (!admin) {
    return Response.json({ ok: false, error: "unavailable" }, { status: 503 });
  }

  const { data: tokenRow } = await admin
    .from("health_tokens")
    .select("user_id")
    .eq("token", credentials.token)
    .maybeSingle();
  if (!tokenRow) {
    return Response.json(
      { ok: false, error: "unauthorized" },
      { status: 401 },
    );
  }

  const { data: membership } = await admin
    .from("room_members")
    .select("user_id")
    .eq("room_id", credentials.roomId)
    .eq("user_id", tokenRow.user_id)
    .maybeSingle();
  if (!membership) {
    return Response.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const { error } = await admin.from("step_sessions").insert({
    room_id: credentials.roomId,
    user_id: tokenRow.user_id,
    steps: parsed.data.steps,
    source: "health",
  });
  if (error) {
    console.error("[api/steps]", error);
    return Response.json(
      { ok: false, error: "server_error" },
      { status: 500 },
    );
  }

  await earnFromSteps(tokenRow.user_id);
  return Response.json({ ok: true, steps: parsed.data.steps });
}
