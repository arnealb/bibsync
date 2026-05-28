import {
  cardScore,
  handTotal,
  isBlackjack,
  isBust,
  type BlackjackResult,
} from "@/lib/blackjack/engine";
import type { Card } from "@/lib/poker/cards";

/**
 * Multiplayer (shared-table) Blackjack: several seated players, one dealer, one
 * shoe. Real-casino flow per round: betting → each seat plays in turn order
 * (hit/stand/double/split) → dealer plays once → settle. Pure + deterministic
 * given a shuffled deck. The action layer keeps the deck server-side and ships
 * only the masked public view (dealer hole hidden until the dealer plays).
 */

export type TablePhase = "betting" | "player" | "done";

export interface TableHand {
  cards: Card[];
  bet: number;
  doubled: boolean;
  done: boolean;
  result: BlackjackResult | null;
  payout: number;
}

export interface Seat {
  userId: string;
  /** Bet for the current round; 0 = seated but sitting this round out. */
  bet: number;
  hands: TableHand[];
  activeHand: number;
  done: boolean;
}

export interface TableState {
  roundNo: number;
  phase: TablePhase;
  seats: Seat[];
  dealer: Card[];
  deck: Card[]; // PRIVATE — never sent to clients
  toActIndex: number | null; // seat whose turn it is during "player"
  version: number;
}

export interface PublicHand {
  cards: Card[];
  total: number;
  bet: number;
  doubled: boolean;
  done: boolean;
  result: BlackjackResult | null;
  payout: number;
}

export interface PublicSeat {
  userId: string;
  bet: number;
  hands: PublicHand[];
  activeHand: number;
  done: boolean;
}

export interface PublicTable {
  roundNo: number;
  phase: TablePhase;
  seats: PublicSeat[];
  dealer: Card[];
  dealerTotal: number | null;
  toActIndex: number | null;
  version: number;
}

const MIN_PLAYABLE_DECK = 15; // reshuffle before the shoe runs thin

export function initialTable(): TableState {
  return {
    roundNo: 0,
    phase: "betting",
    seats: [],
    dealer: [],
    deck: [],
    toActIndex: null,
    version: 0,
  };
}

function newHand(cards: Card[], bet: number): TableHand {
  return { cards, bet, doubled: false, done: false, result: null, payout: 0 };
}

function draw(state: TableState): Card {
  const card = state.deck.shift();
  if (!card) throw new Error("De schoen is leeg.");
  return card;
}

/** Adds a seat for the user if not already seated. */
export function addSeat(state: TableState, userId: string): TableState {
  if (state.seats.some((s) => s.userId === userId)) return state;
  const s = structuredClone(state);
  s.seats.push({ userId, bet: 0, hands: [], activeHand: 0, done: true });
  return s;
}

/** Removes a seat. Mid-hand this forfeits the seat's bet (handled by caller). */
export function removeSeat(state: TableState, userId: string): TableState {
  const index = state.seats.findIndex((s) => s.userId === userId);
  if (index === -1) return state;
  const s = structuredClone(state);
  s.seats.splice(index, 1);

  if (s.phase === "player") {
    if (s.toActIndex !== null && index < s.toActIndex) {
      s.toActIndex -= 1;
    }
    // The leaver may have been the active seat (or the table may now be empty).
    if (s.seats.length === 0) {
      return { ...initialTable(), seats: [], version: s.version };
    }
    if (s.toActIndex !== null && s.toActIndex >= s.seats.length) {
      toDealerAndResolve(s);
    } else if (s.toActIndex !== null) {
      const seat = s.seats[s.toActIndex];
      if (!seat || seat.done) advanceSeat(s, s.toActIndex - 1);
    }
  }
  return s;
}

/** Places (or replaces) a seat's bet during the betting phase. */
export function placeBet(
  state: TableState,
  userId: string,
  amount: number,
): TableState {
  if (state.phase !== "betting") throw new Error("Je kan nu niet inzetten.");
  if (amount <= 0) throw new Error("Ongeldige inzet.");
  const s = addSeat(state, userId);
  const next = structuredClone(s);
  const seat = next.seats.find((x) => x.userId === userId)!;
  seat.bet = amount;
  return next;
}

/** True once at least one seated player has placed a bet. */
export function hasBets(state: TableState): boolean {
  return state.seats.some((s) => s.bet > 0);
}

/** Whether the shoe should be reshuffled before dealing. */
export function needsShuffle(state: TableState): boolean {
  return state.deck.length < MIN_PLAYABLE_DECK;
}

function firstActionable(state: TableState): number | null {
  for (let i = 0; i < state.seats.length; i++) {
    const seat = state.seats[i]!;
    if (seat.hands.length > 0 && !seat.done) return i;
  }
  return null;
}

/** Deals a new round to every seat that has bet. `deck` is the shuffled shoe. */
export function deal(state: TableState, deck: Card[]): TableState {
  if (state.phase !== "betting") throw new Error("De ronde is al bezig.");
  if (!hasBets(state)) throw new Error("Niemand heeft ingezet.");

  const s = structuredClone(state);
  s.deck = [...deck];
  s.dealer = [];

  for (const seat of s.seats) {
    if (seat.bet > 0) {
      seat.hands = [newHand([draw(s), draw(s)], seat.bet)];
      seat.activeHand = 0;
      seat.done = false;
    } else {
      seat.hands = [];
      seat.activeHand = 0;
      seat.done = true;
    }
  }
  s.dealer = [draw(s), draw(s)];

  // Naturals finish acting immediately (settled vs. the dealer at resolve).
  for (const seat of s.seats) {
    const hand = seat.hands[0];
    if (hand && isBlackjack(hand.cards)) {
      hand.done = true;
      seat.done = true;
    }
  }

  s.phase = "player";
  const first = firstActionable(s);
  // A dealer blackjack does NOT end the round early: players still draw, so
  // someone can also reach 21 and push. The hole card stays masked until the
  // dealer plays, and resolveAll compares totals (21 vs 21 = push).
  if (first === null) {
    toDealerAndResolve(s);
  } else {
    s.toActIndex = first;
  }
  return s;
}

function activeHand(seat: Seat): TableHand {
  return seat.hands[seat.activeHand]!;
}

/** Move a seat to its next unfinished hand, or mark the whole seat done. */
function advanceHand(seat: Seat): void {
  let next = seat.activeHand + 1;
  while (next < seat.hands.length && seat.hands[next]!.done) next += 1;
  if (next < seat.hands.length) {
    seat.activeHand = next;
  } else {
    seat.done = true;
  }
}

/** Advance the turn to the next actionable seat after `from`, else the dealer. */
function advanceSeat(state: TableState, from: number): void {
  for (let i = from + 1; i < state.seats.length; i++) {
    const seat = state.seats[i]!;
    if (seat.hands.length > 0 && !seat.done) {
      state.toActIndex = i;
      return;
    }
  }
  toDealerAndResolve(state);
}

function playDealer(state: TableState): void {
  const someoneLive = state.seats.some((seat) =>
    seat.hands.some((h) => handTotal(h.cards).total <= 21),
  );
  if (!someoneLive) return; // everyone busted — dealer needn't draw
  while (handTotal(state.dealer).total < 17 && state.deck.length > 0) {
    state.dealer.push(state.deck.shift()!);
  }
}

function resolveAll(state: TableState): void {
  const dealerTotal = handTotal(state.dealer).total;
  const dealerBJ = isBlackjack(state.dealer);
  for (const seat of state.seats) {
    for (const hand of seat.hands) {
      if (hand.result) continue;
      const total = handTotal(hand.cards).total;
      const natural = seat.hands.length === 1 && isBlackjack(hand.cards);
      if (total > 21) {
        hand.result = "lose";
        hand.payout = 0;
      } else if (natural && !dealerBJ) {
        hand.result = "blackjack";
        hand.payout = Math.floor(hand.bet * 2.5); // 3:2 + stake
      } else if (dealerTotal > 21 || total > dealerTotal) {
        hand.result = "win";
        hand.payout = hand.bet * 2;
      } else if (total < dealerTotal) {
        hand.result = "lose";
        hand.payout = 0;
      } else {
        hand.result = "push";
        hand.payout = hand.bet;
      }
    }
  }
  state.phase = "done";
  state.toActIndex = null;
}

function toDealerAndResolve(state: TableState): void {
  playDealer(state);
  resolveAll(state);
}

export interface SeatActions {
  canHit: boolean;
  canStand: boolean;
  canDouble: boolean;
  canSplit: boolean;
}

function canSplitSeat(seat: Seat): boolean {
  if (seat.hands.length !== 1) return false;
  const hand = seat.hands[0]!;
  return (
    hand.cards.length === 2 &&
    cardScore(hand.cards[0]!) === cardScore(hand.cards[1]!)
  );
}

/** What the given user may do right now (all false if it isn't their turn). */
export function legalSeatActions(
  state: TableState,
  userId: string,
): SeatActions {
  const none = { canHit: false, canStand: false, canDouble: false, canSplit: false };
  if (state.phase !== "player" || state.toActIndex === null) return none;
  const seat = state.seats[state.toActIndex];
  if (!seat || seat.userId !== userId || seat.done) return none;
  const hand = activeHand(seat);
  if (!hand || hand.done) return none;
  const fresh = hand.cards.length === 2 && !hand.doubled;
  return {
    canHit: true,
    canStand: true,
    canDouble: fresh,
    canSplit: canSplitSeat(seat),
  };
}

export type SeatActionKind = "hit" | "stand" | "double" | "split";

/**
 * Applies one player action for `userId`'s active hand. `double`/`split` assume
 * the caller has already charged the extra stake. Throws on an illegal move.
 */
export function applyAction(
  state: TableState,
  userId: string,
  action: SeatActionKind,
): TableState {
  if (state.phase !== "player" || state.toActIndex === null) {
    throw new Error("Er is nu geen ronde bezig.");
  }
  if (state.seats[state.toActIndex]?.userId !== userId) {
    throw new Error("Het is niet jouw beurt.");
  }

  const s = structuredClone(state);
  const seatIndex = s.toActIndex!;
  const seat = s.seats[seatIndex]!;
  const hand = activeHand(seat);

  switch (action) {
    case "hit": {
      hand.cards.push(draw(s));
      if (isBust(hand.cards)) {
        hand.done = true;
        hand.result = "lose";
        hand.payout = 0;
        advanceHand(seat);
      }
      break;
    }
    case "stand": {
      hand.done = true;
      advanceHand(seat);
      break;
    }
    case "double": {
      if (hand.cards.length !== 2 || hand.doubled) {
        throw new Error("Verdubbelen kan hier niet.");
      }
      hand.doubled = true;
      hand.bet *= 2;
      hand.cards.push(draw(s));
      hand.done = true;
      if (isBust(hand.cards)) {
        hand.result = "lose";
        hand.payout = 0;
      }
      advanceHand(seat);
      break;
    }
    case "split": {
      if (!canSplitSeat(seat)) throw new Error("Splitsen kan hier niet.");
      const [first, second] = seat.hands[0]!.cards;
      const aces = cardScore(first!) === 11;
      const a = newHand([first!], seat.bet);
      const b = newHand([second!], seat.bet);
      a.cards.push(draw(s));
      b.cards.push(draw(s));
      seat.hands = [a, b];
      seat.activeHand = 0;
      if (aces) {
        // Split aces get one card each and stand automatically.
        a.done = true;
        b.done = true;
        seat.done = true;
      }
      break;
    }
  }

  if (seat.done) advanceSeat(s, seatIndex);
  return s;
}

/** Resets seats for a fresh betting round, keeping the seating order. */
export function startBetting(state: TableState): TableState {
  const s = structuredClone(state);
  s.roundNo += 1;
  s.phase = "betting";
  s.dealer = [];
  s.toActIndex = null;
  for (const seat of s.seats) {
    seat.bet = 0;
    seat.hands = [];
    seat.activeHand = 0;
    seat.done = true;
  }
  return s;
}

export function seatPayout(seat: { hands: { payout: number }[] }): number {
  return seat.hands.reduce((sum, h) => sum + h.payout, 0);
}

function toPublicHand(hand: TableHand): PublicHand {
  return {
    cards: hand.cards,
    total: handTotal(hand.cards).total,
    bet: hand.bet,
    doubled: hand.doubled,
    done: hand.done,
    result: hand.result,
    payout: hand.payout,
  };
}

/** Masks the deck (always) and the dealer hole card (until the dealer plays). */
export function toPublicTable(state: TableState): PublicTable {
  const revealed = state.phase !== "player";
  return {
    roundNo: state.roundNo,
    phase: state.phase,
    seats: state.seats.map((seat) => ({
      userId: seat.userId,
      bet: seat.bet,
      hands: seat.hands.map(toPublicHand),
      activeHand: seat.activeHand,
      done: seat.done,
    })),
    dealer: revealed ? state.dealer : state.dealer.slice(0, 1),
    dealerTotal: revealed ? handTotal(state.dealer).total : null,
    toActIndex: state.toActIndex,
    version: state.version,
  };
}
