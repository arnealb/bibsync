import {
  LOTTERY_DRAW_WINDOW_MS,
  LOTTERY_MIN_PLAYERS,
  LOTTERY_RAKE,
} from "@/lib/lottery/config";

/** Pure lottery round state + transitions. No persistence here. */

export interface LotteryTicket {
  userId: string;
  count: number;
}

export interface LotteryState {
  roundNo: number;
  phase: "open" | "drawn";
  tickets: LotteryTicket[];
  /** Total coins in the pot (sum of ticket prices). */
  pot: number;
  /** ISO deadline; set once {@link LOTTERY_MIN_PLAYERS} distinct buyers join. */
  endsAt: string | null;
  winnerId: string | null;
  /** Coins paid to the winner. */
  prize: number;
  drawnAt: string | null;
}

export function initialLottery(): LotteryState {
  return {
    roundNo: 1,
    phase: "open",
    tickets: [],
    pot: 0,
    endsAt: null,
    winnerId: null,
    prize: 0,
    drawnAt: null,
  };
}

/** Tickets held by a user this round. */
export function ticketsFor(state: LotteryState, userId: string): number {
  return state.tickets.find((t) => t.userId === userId)?.count ?? 0;
}

export function totalTickets(state: LotteryState): number {
  return state.tickets.reduce((sum, t) => sum + t.count, 0);
}

/** Add `count` tickets for a user; starts the countdown at enough players. */
export function addTickets(
  state: LotteryState,
  userId: string,
  count: number,
  price: number,
  nowIso: string,
): LotteryState {
  const existing = state.tickets.find((t) => t.userId === userId);
  const tickets = existing
    ? state.tickets.map((t) =>
        t.userId === userId ? { ...t, count: t.count + count } : t,
      )
    : [...state.tickets, { userId, count }];

  const endsAt =
    state.endsAt ??
    (tickets.length >= LOTTERY_MIN_PLAYERS
      ? new Date(Date.parse(nowIso) + LOTTERY_DRAW_WINDOW_MS).toISOString()
      : null);

  return { ...state, tickets, pot: state.pot + count * price, endsAt };
}

/** Whether the round can be drawn (enough distinct players have bought in). */
export function canDraw(state: LotteryState): boolean {
  return state.phase === "open" && state.tickets.length >= LOTTERY_MIN_PLAYERS;
}

/**
 * Pick the winning ticket. Each ticket has an equal chance, so a player's odds
 * scale with how many they hold. `rng` is `() => number` in [0, 1).
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

/** Resolve the round: pick a winner and compute the prize. */
export function resolveLottery(
  state: LotteryState,
  rng: () => number,
  nowIso: string,
): LotteryState {
  const winnerId = drawWinner(state, rng);
  const prize = Math.floor(state.pot * (1 - LOTTERY_RAKE));
  return { ...state, phase: "drawn", winnerId, prize, drawnAt: nowIso };
}

/** Open the next round. */
export function startRound(state: LotteryState): LotteryState {
  return { ...initialLottery(), roundNo: state.roundNo + 1 };
}
