/**
 * "Laatste sessie" leaderboard maths — net win/loss of a user's most recent
 * gambling session, computed purely from the bibcoin ledger so it's testable.
 *
 * Only casino games (where you can win AND lose) count: roulette, blackjack and
 * poker. Each writes `<game>_bet`/`<game>_buyin` (negative), `<game>_payout`/
 * `<game>_cashout` (positive) and `<game>_refund` (reversal) transactions, so
 * summing the amounts of a session yields the realised P/L.
 */

const GAME_PL_PREFIXES = ["roulette_", "blackjack_", "poker_"] as const;

/** A new play session starts after this long without a game transaction. */
export const SESSION_GAP_MS = 45 * 60 * 1000;

/** True for a bibcoin transaction reason that represents casino game P/L. */
export function isGamePnL(reason: string): boolean {
  return GAME_PL_PREFIXES.some((prefix) => reason.startsWith(prefix));
}

export interface GameTx {
  amount: number;
  created_at: string;
}

export interface SessionResult {
  net: number;
  rounds: number;
  endedAt: string;
}

/**
 * Net win/loss of the most recent play session — the trailing run of game
 * transactions with no gap larger than `gapMs`. Returns null when empty.
 */
export function lastSessionNet(
  txs: GameTx[],
  gapMs: number = SESSION_GAP_MS,
): SessionResult | null {
  if (txs.length === 0) return null;

  const sorted = [...txs].sort(
    (a, b) => Date.parse(a.created_at) - Date.parse(b.created_at),
  );
  const endedAt = sorted[sorted.length - 1].created_at;

  let net = 0;
  let rounds = 0;
  let prev = Date.parse(endedAt);
  // Walk backwards from the latest transaction until a gap breaks the session.
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    const at = Date.parse(sorted[i].created_at);
    if (prev - at > gapMs) break;
    net += sorted[i].amount;
    rounds += 1;
    prev = at;
  }

  return { net, rounds, endedAt };
}
