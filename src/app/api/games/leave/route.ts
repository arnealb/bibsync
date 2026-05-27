import { leaveBlackjack } from "@/app/_actions/blackjack";
import { leavePokerTable } from "@/app/_actions/poker";

/**
 * Best-effort "free my seat" endpoint hit by `navigator.sendBeacon` on tab
 * close / refresh (when React cleanups don't run). The leave actions
 * authenticate via the session cookie (sent with the beacon) and are no-ops
 * when the caller isn't seated.
 */
export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }

  const { roomId, game } =
    (body as { roomId?: unknown; game?: unknown }) ?? {};
  if (typeof roomId !== "string") {
    return Response.json({ ok: false }, { status: 400 });
  }

  if (game === "blackjack") {
    await leaveBlackjack(roomId);
  } else if (game === "poker") {
    await leavePokerTable(roomId);
  } else {
    return Response.json({ ok: false }, { status: 400 });
  }

  return Response.json({ ok: true });
}
