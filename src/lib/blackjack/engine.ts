import { cardRankChar, type Card } from "@/lib/poker/cards";

/**
 * Single-player Blackjack vs the dealer, with split & double. Pure +
 * deterministic given a deck. The action layer keeps the deck server-side and
 * sends only the masked public view so the dealer hole card stays hidden.
 */

export type BlackjackStatus = "player" | "dealer" | "done";
export type BlackjackResult = "win" | "lose" | "push" | "blackjack";

export interface BJHand {
  cards: Card[];
  bet: number;
  doubled: boolean;
  done: boolean; // player finished acting on this hand
  result: BlackjackResult | null;
  payout: number;
}

export interface BlackjackState {
  roundId: string;
  status: BlackjackStatus;
  hands: BJHand[]; // 1 normally, 2 after a split
  active: number; // index of the hand currently being played
  dealer: Card[];
  deck: Card[];
  baseBet: number;
  splitAces: boolean;
}

export interface PublicHand {
  cards: Card[];
  total: number;
  bet: number;
  doubled: boolean;
  done: boolean;
  active: boolean;
  result: BlackjackResult | null;
  payout: number;
}

export interface PublicBlackjack {
  roundId: string;
  status: BlackjackStatus;
  hands: PublicHand[];
  dealer: Card[];
  dealerTotal: number | null;
  baseBet: number;
  canHit: boolean;
  canStand: boolean;
  canDouble: boolean;
  canSplit: boolean;
  totalPayout: number;
}

function cardScore(card: Card): number {
  const rank = cardRankChar(card);
  if (rank === "A") return 11;
  if (rank === "T" || rank === "J" || rank === "Q" || rank === "K") return 10;
  return Number(rank);
}

export function handTotal(cards: Card[]): { total: number; soft: boolean } {
  let total = 0;
  let aces = 0;
  for (const card of cards) {
    total += cardScore(card);
    if (cardRankChar(card) === "A") aces += 1;
  }
  let soft = aces > 0;
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  if (aces === 0) soft = false;
  return { total, soft };
}

export function isBust(cards: Card[]): boolean {
  return handTotal(cards).total > 21;
}

export function isBlackjack(cards: Card[]): boolean {
  return cards.length === 2 && handTotal(cards).total === 21;
}

function newHand(cards: Card[], bet: number): BJHand {
  return { cards, bet, doubled: false, done: false, result: null, payout: 0 };
}

function draw(state: BlackjackState): Card {
  return state.deck.shift()!;
}

function playDealer(state: BlackjackState): void {
  while (handTotal(state.dealer).total < 17) {
    const card = state.deck.shift();
    if (!card) break;
    state.dealer.push(card);
  }
}

function resolveAll(state: BlackjackState): void {
  const dealer = handTotal(state.dealer).total;
  for (const hand of state.hands) {
    if (hand.result) continue; // already resolved (natural / bust)
    const total = handTotal(hand.cards).total;
    if (total > 21) {
      hand.result = "lose";
      hand.payout = 0;
    } else if (dealer > 21 || total > dealer) {
      hand.result = "win";
      hand.payout = hand.bet * 2;
    } else if (total < dealer) {
      hand.result = "lose";
      hand.payout = 0;
    } else {
      hand.result = "push";
      hand.payout = hand.bet;
    }
  }
  state.status = "done";
}

/** Reveal the dealer and settle once every hand has been played. */
function toDealer(state: BlackjackState): void {
  state.status = "dealer";
  if (state.hands.some((h) => handTotal(h.cards).total <= 21)) {
    playDealer(state);
  }
  resolveAll(state);
}

/** Advance to the next unfinished hand, or hand it to the dealer. */
function advance(state: BlackjackState): void {
  let next = state.active + 1;
  while (next < state.hands.length && state.hands[next]!.done) next += 1;
  if (next < state.hands.length) {
    state.active = next;
  } else {
    toDealer(state);
  }
}

function activeHand(state: BlackjackState): BJHand {
  return state.hands[state.active]!;
}

export function deal(
  roundId: string,
  shuffledDeck: Card[],
  bet: number,
): BlackjackState {
  const deck = [...shuffledDeck];
  const hand = newHand([deck.shift()!, deck.shift()!], bet);
  const dealer = [deck.shift()!, deck.shift()!];
  const state: BlackjackState = {
    roundId,
    status: "player",
    hands: [hand],
    active: 0,
    dealer,
    deck,
    baseBet: bet,
    splitAces: false,
  };

  if (isBlackjack(hand.cards)) {
    hand.done = true;
    if (isBlackjack(dealer)) {
      hand.result = "push";
      hand.payout = bet;
    } else {
      hand.result = "blackjack";
      hand.payout = Math.floor(bet * 2.5); // 3:2 + stake
    }
    state.status = "done";
  }
  return state;
}

export function canSplit(state: BlackjackState): boolean {
  if (state.status !== "player" || state.hands.length !== 1) return false;
  const hand = state.hands[0]!;
  return (
    hand.cards.length === 2 &&
    cardScore(hand.cards[0]!) === cardScore(hand.cards[1]!)
  );
}

export function hit(state: BlackjackState): BlackjackState {
  if (state.status !== "player") throw new Error("Je kan nu niet bijtrekken.");
  const s = structuredClone(state);
  const hand = activeHand(s);
  hand.cards.push(draw(s));
  if (isBust(hand.cards)) {
    hand.done = true;
    hand.result = "lose";
    hand.payout = 0;
    advance(s);
  }
  return s;
}

export function stand(state: BlackjackState): BlackjackState {
  if (state.status !== "player") throw new Error("Je kan nu niet passen.");
  const s = structuredClone(state);
  activeHand(s).done = true;
  advance(s);
  return s;
}

/** Double the active hand (caller charges the extra), draw one, then move on. */
export function doubleDown(state: BlackjackState): BlackjackState {
  const hand = state.status === "player" ? state.hands[state.active] : null;
  if (!hand || hand.cards.length !== 2 || hand.doubled) {
    throw new Error("Verdubbelen kan hier niet.");
  }
  const s = structuredClone(state);
  const h = activeHand(s);
  h.doubled = true;
  h.bet *= 2;
  h.cards.push(draw(s));
  h.done = true;
  if (isBust(h.cards)) {
    h.result = "lose";
    h.payout = 0;
  }
  advance(s);
  return s;
}

/** Split a pair into two hands (caller charges the extra bet). */
export function split(state: BlackjackState): BlackjackState {
  if (!canSplit(state)) throw new Error("Splitsen kan hier niet.");
  const s = structuredClone(state);
  const [first, second] = s.hands[0]!.cards;
  const aces = cardScore(first!) === 11;

  const handA = newHand([first!], s.baseBet);
  const handB = newHand([second!], s.baseBet);
  s.hands = [handA, handB];
  handA.cards.push(draw(s));
  handB.cards.push(draw(s));
  s.active = 0;
  s.splitAces = aces;

  if (aces) {
    // Split aces get exactly one card each and stand automatically.
    handA.done = true;
    handB.done = true;
    toDealer(s);
  }
  return s;
}

export function totalPayout(state: BlackjackState): number {
  return state.hands.reduce((sum, hand) => sum + hand.payout, 0);
}

export function toPublicBlackjack(state: BlackjackState): PublicBlackjack {
  const revealed = state.status !== "player";
  const hand = state.hands[state.active];
  const playing = state.status === "player" && hand && !hand.done;
  return {
    roundId: state.roundId,
    status: state.status,
    dealer: revealed ? state.dealer : [state.dealer[0]!],
    dealerTotal: revealed ? handTotal(state.dealer).total : null,
    baseBet: state.baseBet,
    hands: state.hands.map((h, i) => ({
      cards: h.cards,
      total: handTotal(h.cards).total,
      bet: h.bet,
      doubled: h.doubled,
      done: h.done,
      active: state.status === "player" && i === state.active,
      result: h.result,
      payout: h.payout,
    })),
    canHit: Boolean(playing),
    canStand: Boolean(playing),
    canDouble: Boolean(playing && hand!.cards.length === 2 && !hand!.doubled),
    canSplit: canSplit(state),
    totalPayout: totalPayout(state),
  };
}
