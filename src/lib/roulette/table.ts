import { totalPayout, type Bet } from "@/lib/roulette/engine";

/**
 * Shared-table roulette: everyone places bibcoin bets during a timed window,
 * then one spin resolves all of them. Pure + deterministic; the action layer
 * owns the clock (deadlines) and the RNG (winning number).
 */

export interface PlacedBet extends Bet {
  userId: string;
}

export interface RoundResult {
  userId: string;
  staked: number;
  payout: number;
}

export interface RouletteTable {
  roundNo: number;
  phase: "betting" | "result";
  /** ISO time the betting window closes; null until the first bet is placed. */
  bettingEndsAt: string | null;
  bets: PlacedBet[];
  winningNumber: number | null;
  results: RoundResult[] | null;
  version: number;
}

export function initialRouletteTable(): RouletteTable {
  return {
    roundNo: 0,
    phase: "betting",
    bettingEndsAt: null,
    bets: [],
    winningNumber: null,
    results: null,
    version: 0,
  };
}

function sameSpot(
  a: { type: string; value?: number },
  b: { type: string; value?: number },
): boolean {
  return a.type === b.type && (a.value ?? null) === (b.value ?? null);
}

/** Adds a bet, merging into the user's existing wager on the same spot. */
export function addBet(
  state: RouletteTable,
  userId: string,
  bet: Bet,
): RouletteTable {
  const bets = state.bets.map((b) => ({ ...b }));
  const idx = bets.findIndex((b) => b.userId === userId && sameSpot(b, bet));
  if (idx >= 0) {
    bets[idx] = { ...bets[idx]!, amount: bets[idx]!.amount + bet.amount };
  } else {
    bets.push({ userId, ...bet });
  }
  return { ...state, bets };
}

/** Total amount a user has staked this round. */
export function stakeFor(bets: PlacedBet[], userId: string): number {
  return bets
    .filter((b) => b.userId === userId)
    .reduce((sum, b) => sum + b.amount, 0);
}

/** Resolves every player's bets against the winning number. */
export function resolveRound(
  state: RouletteTable,
  winningNumber: number,
): RouletteTable {
  const byUser = new Map<string, Bet[]>();
  for (const b of state.bets) {
    const list = byUser.get(b.userId);
    const bet: Bet = { type: b.type, value: b.value, amount: b.amount };
    if (list) list.push(bet);
    else byUser.set(b.userId, [bet]);
  }

  const results: RoundResult[] = [...byUser.entries()].map(([userId, bets]) => ({
    userId,
    staked: bets.reduce((sum, b) => sum + b.amount, 0),
    payout: totalPayout(bets, winningNumber),
  }));

  return {
    ...state,
    phase: "result",
    winningNumber,
    results,
    bettingEndsAt: null,
  };
}

/** Opens a fresh betting round, clearing the previous bets and result. */
export function startBetting(state: RouletteTable): RouletteTable {
  return {
    ...state,
    roundNo: state.roundNo + 1,
    phase: "betting",
    bettingEndsAt: null,
    bets: [],
    winningNumber: null,
    results: null,
  };
}
