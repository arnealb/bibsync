/** Pure lottery round state + transitions. No persistence here.
 *  The draw itself happens server-side at a fixed daily time (pg_cron); this
 *  module only models buying tickets and the (reference) weighted pick. */

export interface LotteryTicket {
  userId: string;
  count: number;
}

export interface LotteryState {
  roundNo: number;
  tickets: LotteryTicket[];
  /** Total coins in the pot (sum of ticket prices). */
  pot: number;
  /** Winner of the previous round (shown as a banner). */
  lastWinnerId: string | null;
  lastPrize: number;
}

export function initialLottery(): LotteryState {
  return { roundNo: 1, tickets: [], pot: 0, lastWinnerId: null, lastPrize: 0 };
}

/** Tickets held by a user this round. */
export function ticketsFor(state: LotteryState, userId: string): number {
  return state.tickets.find((t) => t.userId === userId)?.count ?? 0;
}

export function totalTickets(state: LotteryState): number {
  return state.tickets.reduce((sum, t) => sum + t.count, 0);
}

/** Add `count` tickets for a user and grow the pot. */
export function addTickets(
  state: LotteryState,
  userId: string,
  count: number,
  price: number,
): LotteryState {
  const existing = state.tickets.find((t) => t.userId === userId);
  const tickets = existing
    ? state.tickets.map((t) =>
        t.userId === userId ? { ...t, count: t.count + count } : t,
      )
    : [...state.tickets, { userId, count }];
  return { ...state, tickets, pot: state.pot + count * price };
}

/**
 * Reference weighted draw (the cron reimplements this in SQL). Each ticket has
 * an equal chance, so a player's odds scale with how many they hold. `rng` is
 * `() => number` in [0, 1).
 */
export function drawWinner(state: LotteryState, rng: () => number): string {
  const total = totalTickets(state);
  let pick = Math.floor(rng() * total);
  for (const ticket of state.tickets) {
    if (pick < ticket.count) return ticket.userId;
    pick -= ticket.count;
  }
  return state.tickets[state.tickets.length - 1]?.userId ?? "";
}
