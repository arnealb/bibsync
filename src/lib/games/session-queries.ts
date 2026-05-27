import { getRoomMembers } from "@/lib/rooms/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { isGamePnL, lastSessionNet } from "@/lib/games/sessions";

export interface SessionStanding {
  userId: string;
  name: string;
  avatarUrl: string | null;
  net: number;
  rounds: number;
  endedAt: string;
}

/** Only look back this far for a "last session" (bounds the ledger scan). */
const WINDOW_DAYS = 30;
const MAX_ROWS = 4000;

/**
 * Per-member net win/loss of their most recent gambling session, biggest
 * winners first. Reads the global bibcoin ledger with the service-role client
 * (member P/L isn't readable cross-user under RLS); returns [] when the secret
 * key isn't configured (e.g. local dev) so the page degrades gracefully.
 */
export async function getSessionStandings(
  roomId: string,
): Promise<SessionStanding[]> {
  const admin = createAdminClient();
  if (!admin) return [];

  const members = await getRoomMembers(roomId);
  if (members.length === 0) return [];
  const ids = members.map((member) => member.user_id);

  const since = new Date(
    Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data, error } = await admin
    .from("bibcoin_transactions")
    .select("user_id, amount, reason, created_at")
    .in("user_id", ids)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(MAX_ROWS);

  if (error || !data) {
    if (error) console.error("[getSessionStandings]", error);
    return [];
  }

  const byUser = new Map<string, { amount: number; created_at: string }[]>();
  for (const tx of data) {
    if (!isGamePnL(tx.reason)) continue;
    const entry = { amount: tx.amount, created_at: tx.created_at };
    const list = byUser.get(tx.user_id);
    if (list) list.push(entry);
    else byUser.set(tx.user_id, [entry]);
  }

  const metaOf = new Map(
    members.map((member) => [
      member.user_id,
      {
        name: member.profile?.display_name ?? "—",
        avatarUrl: member.profile?.avatar_url ?? null,
      },
    ]),
  );

  const standings: SessionStanding[] = [];
  for (const [userId, txs] of byUser) {
    const session = lastSessionNet(txs);
    if (!session || session.rounds === 0) continue;
    const meta = metaOf.get(userId);
    standings.push({
      userId,
      name: meta?.name ?? "—",
      avatarUrl: meta?.avatarUrl ?? null,
      net: session.net,
      rounds: session.rounds,
      endedAt: session.endedAt,
    });
  }

  // Biggest winners first; ties broken by the most recent session.
  standings.sort(
    (a, b) => b.net - a.net || Date.parse(b.endedAt) - Date.parse(a.endedAt),
  );
  return standings;
}
