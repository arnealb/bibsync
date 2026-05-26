import { cardRankChar, type Card } from "@/lib/poker/cards";

/**
 * Single-player Blackjack vs the dealer. Pure + deterministic given a deck.
 * The action layer keeps the deck server-side and only ever sends the masked
 * public view (see toPublicBlackjack) so the dealer's hole card stays hidden.
 */

export type BlackjackStatus = "player" | "dealer" | "done";
export type BlackjackResult = "win" | "lose" | "push" | "blackjack";

export interface BlackjackState {
  roundId: string;
  status: BlackjackStatus;
  bet: number;
  player: Card[];
  dealer: Card[];
  deck: Card[];
  doubled: boolean;
  result: BlackjackResult | null;
  /** Amount returned to the wallet on resolution (0 = lost the bet). */
  payout: number;
}

export interface PublicBlackjack {
  roundId: string;
  status: BlackjackStatus;
  bet: number;
  player: Card[];
  playerTotal: number;
  /** Only the dealer's up-card while the player acts; full hand once revealed. */
  dealer: Card[];
  dealerTotal: number | null;
  doubled: boolean;
  canDouble: boolean;
  result: BlackjackResult | null;
  payout: number;
}

/** Blackjack value of a single card (ace = 11 here; reduced later if needed). */
function cardScore(card: Card): number {
  const rank = cardRankChar(card);
  if (rank === "A") return 11;
  if (rank === "T" || rank === "J" || rank === "Q" || rank === "K") return 10;
  return Number(rank);
}

/** Best total for a hand, treating aces as 11 then 1 as needed. */
export function handTotal(cards: Card[]): { total: number; soft: boolean } {
  let total = 0;
  let aces = 0;
  for (const card of cards) {
    total += cardScore(card);
    if (cardRankChar(card) === "A") aces += 1;
  }
  let soft = aces > 0;
  while (total > 21 && aces > 0) {
    total -= 10; // count one ace as 1 instead of 11
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

/** Dealer draws until 17+ (stands on all 17, including soft). */
function playDealer(state: BlackjackState): void {
  while (handTotal(state.dealer).total < 17) {
    const card = state.deck.shift();
    if (!card) break;
    state.dealer.push(card);
  }
}

function settle(state: BlackjackState): void {
  state.status = "done";
  const player = handTotal(state.player).total;
  const dealer = handTotal(state.dealer).total;
  if (player > 21) {
    state.result = "lose";
    state.payout = 0;
  } else if (dealer > 21 || player > dealer) {
    state.result = "win";
    state.payout = state.bet * 2;
  } else if (player < dealer) {
    state.result = "lose";
    state.payout = 0;
  } else {
    state.result = "push";
    state.payout = state.bet;
  }
}

/** Deal a fresh round. Resolves immediately on a natural blackjack. */
export function deal(
  roundId: string,
  shuffledDeck: Card[],
  bet: number,
): BlackjackState {
  const deck = [...shuffledDeck];
  const player = [deck.shift()!, deck.shift()!];
  const dealer = [deck.shift()!, deck.shift()!];
  const state: BlackjackState = {
    roundId,
    status: "player",
    bet,
    player,
    dealer,
    deck,
    doubled: false,
    result: null,
    payout: 0,
  };

  if (isBlackjack(player)) {
    state.status = "done";
    if (isBlackjack(dealer)) {
      state.result = "push";
      state.payout = bet;
    } else {
      state.result = "blackjack";
      state.payout = Math.floor(bet * 2.5); // 3:2 + the stake back
    }
  }
  return state;
}

export function hit(state: BlackjackState): BlackjackState {
  if (state.status !== "player") throw new Error("Je kan nu niet bijtrekken.");
  const next: BlackjackState = structuredClone(state);
  const card = next.deck.shift();
  if (card) next.player.push(card);
  if (isBust(next.player)) {
    next.status = "done";
    next.result = "lose";
    next.payout = 0;
  }
  return next;
}

export function stand(state: BlackjackState): BlackjackState {
  if (state.status !== "player") throw new Error("Je kan nu niet passen.");
  const next: BlackjackState = structuredClone(state);
  next.status = "dealer";
  playDealer(next);
  settle(next);
  return next;
}

/** Double the bet (caller charges the extra), draw exactly one, then resolve. */
export function doubleDown(state: BlackjackState): BlackjackState {
  if (state.status !== "player" || state.player.length !== 2 || state.doubled) {
    throw new Error("Verdubbelen kan hier niet.");
  }
  const next: BlackjackState = structuredClone(state);
  next.doubled = true;
  next.bet *= 2;
  const card = next.deck.shift();
  if (card) next.player.push(card);
  if (isBust(next.player)) {
    next.status = "done";
    next.result = "lose";
    next.payout = 0;
    return next;
  }
  next.status = "dealer";
  playDealer(next);
  settle(next);
  return next;
}

export function toPublicBlackjack(state: BlackjackState): PublicBlackjack {
  const revealed = state.status !== "player";
  return {
    roundId: state.roundId,
    status: state.status,
    bet: state.bet,
    player: state.player,
    playerTotal: handTotal(state.player).total,
    dealer: revealed ? state.dealer : [state.dealer[0]!],
    dealerTotal: revealed ? handTotal(state.dealer).total : null,
    doubled: state.doubled,
    canDouble:
      state.status === "player" && state.player.length === 2 && !state.doubled,
    result: state.result,
    payout: state.payout,
  };
}
