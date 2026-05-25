import type { Card } from "@/lib/poker/cards";
import {
  compareHands,
  evaluate7,
  handLabel,
  type HandValue,
} from "@/lib/poker/evaluate";

export type Street = "preflop" | "flop" | "turn" | "river";
export type PokerStatus = "waiting" | "betting" | "showdown";
export type ActionType = "fold" | "check" | "call" | "raise" | "allin";
export type PlayerStatus = "active" | "folded" | "allin" | "out";

export interface EnginePlayer {
  userId: string;
  chips: number; // stack behind (not yet committed)
  streetCommitted: number; // committed during the current street
  handCommitted: number; // committed across the whole hand
  status: PlayerStatus;
  hasActed: boolean; // has acted since the last raise this street
}

export interface HandResult {
  payouts: { userId: string; amount: number }[];
  revealed: { userId: string; cards: [Card, Card]; hand: string }[];
  potTotal: number;
}

export interface FullState {
  status: PokerStatus;
  street: Street | null;
  players: EnginePlayer[]; // seating order, persists across hands
  buttonIndex: number;
  community: Card[];
  currentBet: number; // highest streetCommitted this street
  minRaise: number; // minimum raise increment
  toActIndex: number | null;
  handNo: number;
  smallBlind: number;
  bigBlind: number;
  lastAction: { userId: string; action: ActionType; amount: number } | null;
  result: HandResult | null;
  version: number;
  deck: Card[]; // PRIVATE — never sent to clients
  hole: Record<string, [Card, Card]>; // PRIVATE — never sent to clients
}

export type PublicState = Omit<FullState, "deck" | "hole">;

export interface LegalActions {
  canFold: boolean;
  canCheck: boolean;
  canCall: boolean;
  callAmount: number;
  canRaise: boolean;
  minRaiseTo: number;
  maxRaiseTo: number;
}

/** Strips the private deck/hole fields for client consumption. */
export function toPublicState(state: FullState): PublicState {
  const rest: PublicState & Partial<Pick<FullState, "deck" | "hole">> = {
    ...state,
  };
  delete rest.deck;
  delete rest.hole;
  return rest;
}

export function initialState(
  smallBlind: number,
  bigBlind: number,
): FullState {
  return {
    status: "waiting",
    street: null,
    players: [],
    buttonIndex: -1,
    community: [],
    currentBet: 0,
    minRaise: bigBlind,
    toActIndex: null,
    handNo: 0,
    smallBlind,
    bigBlind,
    lastAction: null,
    result: null,
    version: 0,
    deck: [],
    hole: {},
  };
}

// --- helpers --------------------------------------------------------------

function clone(state: FullState): FullState {
  return structuredClone(state);
}

function findIndex(state: FullState, userId: string): number {
  return state.players.findIndex((p) => p.userId === userId);
}

/** Next index after `from` (wrapping) whose player satisfies `pred`, or -1. */
function nextIndex(
  state: FullState,
  from: number,
  pred: (p: EnginePlayer) => boolean,
): number {
  const n = state.players.length;
  for (let step = 1; step <= n; step++) {
    const i = (from + step) % n;
    if (pred(state.players[i])) return i;
  }
  return -1;
}

const canAct = (p: EnginePlayer) => p.status === "active";
const inHand = (p: EnginePlayer) =>
  p.status === "active" || p.status === "allin";

function commit(player: EnginePlayer, amount: number): void {
  const pay = Math.min(amount, player.chips);
  player.chips -= pay;
  player.streetCommitted += pay;
  player.handCommitted += pay;
  if (player.chips === 0 && player.status === "active") player.status = "allin";
}

/** Total chips committed to the pot this hand. */
export function potTotal(state: FullState | PublicState): number {
  return state.players.reduce((sum, p) => sum + p.handCommitted, 0);
}

// --- table management -----------------------------------------------------

export function addPlayer(
  state: FullState,
  userId: string,
  startChips: number,
): FullState {
  if (findIndex(state, userId) !== -1) return state;
  const s = clone(state);
  s.players.push({
    userId,
    chips: startChips,
    streetCommitted: 0,
    handCommitted: 0,
    status: "out",
    hasActed: false,
  });
  return s;
}

export function rebuy(
  state: FullState,
  userId: string,
  startChips: number,
): FullState {
  const idx = findIndex(state, userId);
  if (idx === -1) return state;
  const s = clone(state);
  const p = s.players[idx];
  // Only top up a busted player while they are not in a live hand.
  if (p.chips === 0 && p.status !== "active" && p.status !== "allin") {
    p.chips = startChips;
  }
  return s;
}

// --- starting a hand ------------------------------------------------------

export function startHand(state: FullState, shuffledDeck: Card[]): FullState {
  const s = clone(state);
  const eligible = s.players.filter((p) => p.chips > 0);
  if (eligible.length < 2) {
    throw new Error("Niet genoeg spelers met fiches om te starten.");
  }

  // Reset everyone for the new hand.
  for (const p of s.players) {
    p.streetCommitted = 0;
    p.handCommitted = 0;
    p.hasActed = false;
    p.status = p.chips > 0 ? "active" : "out";
  }

  s.deck = [...shuffledDeck];
  s.hole = {};
  s.community = [];
  s.result = null;
  s.street = "preflop";
  s.status = "betting";
  s.handNo += 1;

  // Rotate the button to the next eligible player.
  s.buttonIndex = nextIndex(s, s.buttonIndex, (p) => p.chips > 0 || p.status === "active");

  // Deal two hole cards to each active player.
  for (const p of s.players) {
    if (p.status === "active") {
      const a = s.deck.shift()!;
      const b = s.deck.shift()!;
      s.hole[p.userId] = [a, b];
    }
  }

  const activeCount = s.players.filter(canAct).length;
  let sbIndex: number;
  let bbIndex: number;
  if (activeCount === 2) {
    // Heads-up: the button is the small blind.
    sbIndex = s.buttonIndex;
    bbIndex = nextIndex(s, s.buttonIndex, canAct);
  } else {
    sbIndex = nextIndex(s, s.buttonIndex, canAct);
    bbIndex = nextIndex(s, sbIndex, canAct);
  }

  commit(s.players[sbIndex], s.smallBlind);
  commit(s.players[bbIndex], s.bigBlind);
  s.currentBet = s.bigBlind;
  s.minRaise = s.bigBlind;

  // Blind posters have not voluntarily acted yet (BB keeps the option).
  s.players[sbIndex].hasActed = false;
  s.players[bbIndex].hasActed = false;

  // First to act preflop.
  s.toActIndex =
    activeCount === 2 ? sbIndex : nextIndex(s, bbIndex, canAct);

  s.lastAction = null;
  s.version += 1;

  // Make sure the first actor can actually act, then handle the rare case
  // where everyone is already all-in from posting blinds.
  if (s.toActIndex !== null && !canAct(s.players[s.toActIndex])) {
    s.toActIndex = nextIndex(s, s.toActIndex, canAct);
  }
  if (s.toActIndex === -1 || roundComplete(s)) return runout(s);
  return s;
}

// --- legal actions --------------------------------------------------------

export function legalActions(
  state: FullState,
  userId: string,
): LegalActions {
  const none: LegalActions = {
    canFold: false,
    canCheck: false,
    canCall: false,
    callAmount: 0,
    canRaise: false,
    minRaiseTo: 0,
    maxRaiseTo: 0,
  };
  if (state.status !== "betting" || state.toActIndex === null) return none;
  const idx = findIndex(state, userId);
  if (idx !== state.toActIndex) return none;

  const p = state.players[idx];
  const toCall = state.currentBet - p.streetCommitted;
  const maxRaiseTo = p.streetCommitted + p.chips;
  const canCall = toCall > 0 && p.chips > 0;
  const canRaise = p.chips > toCall; // has chips beyond a flat call
  const minRaiseTo = Math.min(state.currentBet + state.minRaise, maxRaiseTo);

  return {
    canFold: true,
    canCheck: toCall === 0,
    canCall,
    callAmount: Math.min(toCall, p.chips),
    canRaise,
    minRaiseTo,
    maxRaiseTo,
  };
}

// --- applying an action ---------------------------------------------------

export function applyAction(
  state: FullState,
  userId: string,
  action: ActionType,
  amount = 0,
): FullState {
  if (state.status !== "betting" || state.toActIndex === null) {
    throw new Error("Er is geen lopende inzetronde.");
  }
  const idx = findIndex(state, userId);
  if (idx !== state.toActIndex) {
    throw new Error("Het is niet jouw beurt.");
  }

  const s = clone(state);
  const p = s.players[idx];
  const toCall = s.currentBet - p.streetCommitted;

  switch (action) {
    case "fold": {
      p.status = "folded";
      p.hasActed = true;
      break;
    }
    case "check": {
      if (toCall !== 0) throw new Error("Je kan niet checken; er staat een inzet.");
      p.hasActed = true;
      break;
    }
    case "call": {
      if (toCall <= 0) throw new Error("Niets om te callen.");
      commit(p, toCall);
      p.hasActed = true;
      break;
    }
    case "raise":
    case "allin": {
      const target =
        action === "allin" ? p.streetCommitted + p.chips : amount;
      if (target <= p.streetCommitted) throw new Error("Ongeldige verhoging.");
      if (target > p.streetCommitted + p.chips) {
        throw new Error("Zoveel fiches heb je niet.");
      }
      const isFullBet = target > s.currentBet;
      const minTarget = s.currentBet + s.minRaise;
      const isAllIn = target === p.streetCommitted + p.chips;
      if (isFullBet && target < minTarget && !isAllIn) {
        throw new Error("Verhoging is te klein.");
      }
      commit(p, target - p.streetCommitted);
      p.hasActed = true;
      if (target > s.currentBet) {
        s.minRaise = Math.max(s.bigBlind, target - s.currentBet);
        s.currentBet = target;
        // Reopen the action for everyone else still able to act.
        for (const other of s.players) {
          if (other.userId !== p.userId && canAct(other)) {
            other.hasActed = false;
          }
        }
      }
      break;
    }
  }

  s.lastAction = {
    userId,
    action,
    amount: action === "fold" || action === "check" ? 0 : p.streetCommitted,
  };
  s.version += 1;
  return progress(s);
}

// --- progressing the hand -------------------------------------------------

function roundComplete(state: FullState): boolean {
  const actors = state.players.filter(canAct);
  if (actors.length === 0) return true;
  return actors.every(
    (p) => p.hasActed && p.streetCommitted === state.currentBet,
  );
}

function resetForStreet(state: FullState): void {
  for (const p of state.players) {
    p.streetCommitted = 0;
    if (p.status === "active") p.hasActed = false;
  }
  state.currentBet = 0;
  state.minRaise = state.bigBlind;
}

function dealCommunity(state: FullState, count: number): void {
  for (let i = 0; i < count; i++) {
    const card = state.deck.shift();
    if (card) state.community.push(card);
  }
}

/** Order of player indices clockwise starting left of the button. */
function seatOrderFromButton(state: FullState): number[] {
  const n = state.players.length;
  const order: number[] = [];
  for (let step = 1; step <= n; step++) {
    order.push((state.buttonIndex + step) % n);
  }
  return order;
}

/** Deals the board out and runs the showdown when no betting can continue. */
function runout(state: FullState): FullState {
  const contenders = state.players.filter(inHand);
  if (contenders.length <= 1) {
    settleSingle(state);
    return state;
  }
  while (state.community.length < 5) {
    dealCommunity(state, state.community.length === 0 ? 3 : 1);
  }
  showdown(state);
  return state;
}

/** Called after an action: advances the turn, or the street, or settles. */
function progress(state: FullState): FullState {
  const contenders = state.players.filter(inHand);
  if (contenders.length <= 1) {
    settleSingle(state);
    return state;
  }

  if (roundComplete(state)) {
    const actorsLeft = state.players.filter(canAct).length;
    if (state.street === "river" || actorsLeft <= 1) {
      return runout(state);
    }

    // Advance to the next street and act from the button's left.
    resetForStreet(state);
    if (state.street === "preflop") {
      state.street = "flop";
      dealCommunity(state, 3);
    } else if (state.street === "flop") {
      state.street = "turn";
      dealCommunity(state, 1);
    } else if (state.street === "turn") {
      state.street = "river";
      dealCommunity(state, 1);
    }
    state.toActIndex = nextIndex(state, state.buttonIndex, canAct);
    return state;
  }

  // Round not complete: pass the turn to the next unsettled active player.
  const from = state.toActIndex ?? state.buttonIndex;
  state.toActIndex = nextIndex(
    state,
    from,
    (p) => canAct(p) && !(p.hasActed && p.streetCommitted === state.currentBet),
  );
  return state;
}

function settleSingle(state: FullState): void {
  const winner = state.players.find(inHand);
  const pot = potTotal(state);
  if (winner) winner.chips += pot;
  state.status = "showdown";
  state.toActIndex = null;
  state.result = {
    payouts: winner ? [{ userId: winner.userId, amount: pot }] : [],
    revealed: [],
    potTotal: pot,
  };
}

interface SidePot {
  amount: number;
  eligible: string[]; // userIds not folded/out
}

/** Layered side pots from per-player hand contributions. */
export function buildSidePots(players: EnginePlayer[]): SidePot[] {
  const levels = [
    ...new Set(
      players.map((p) => p.handCommitted).filter((amount) => amount > 0),
    ),
  ].sort((a, b) => a - b);

  const pots: SidePot[] = [];
  let prev = 0;
  for (const level of levels) {
    const layer = level - prev;
    const contributors = players.filter((p) => p.handCommitted >= level);
    const eligible = contributors
      .filter((p) => p.status === "active" || p.status === "allin")
      .map((p) => p.userId);
    pots.push({ amount: layer * contributors.length, eligible });
    prev = level;
  }
  return pots;
}

function showdown(state: FullState): void {
  const contenders = state.players.filter(inHand);
  const handValues = new Map<string, HandValue>();
  for (const p of contenders) {
    const hole = state.hole[p.userId];
    handValues.set(p.userId, evaluate7([...hole, ...state.community]));
  }

  const order = seatOrderFromButton(state);
  const seatRank = new Map<string, number>();
  order.forEach((idx, rank) => seatRank.set(state.players[idx].userId, rank));

  const payouts = new Map<string, number>();
  const pots = buildSidePots(state.players);
  for (const pot of pots) {
    if (pot.eligible.length === 0 || pot.amount === 0) continue;
    let best: HandValue | null = null;
    for (const id of pot.eligible) {
      const v = handValues.get(id)!;
      if (!best || compareHands(v, best) > 0) best = v;
    }
    const winners = pot.eligible
      .filter((id) => compareHands(handValues.get(id)!, best!) === 0)
      .sort((a, b) => (seatRank.get(a) ?? 0) - (seatRank.get(b) ?? 0));
    const share = Math.floor(pot.amount / winners.length);
    let remainder = pot.amount - share * winners.length;
    for (const id of winners) {
      const extra = remainder > 0 ? 1 : 0;
      remainder -= extra;
      payouts.set(id, (payouts.get(id) ?? 0) + share + extra);
    }
  }

  for (const [id, amount] of payouts) {
    const p = state.players.find((q) => q.userId === id)!;
    p.chips += amount;
  }

  state.status = "showdown";
  state.toActIndex = null;
  state.result = {
    payouts: [...payouts.entries()].map(([userId, amount]) => ({
      userId,
      amount,
    })),
    revealed: contenders.map((p) => ({
      userId: p.userId,
      cards: state.hole[p.userId],
      hand: handLabel(handValues.get(p.userId)!),
    })),
    potTotal: potTotal(state),
  };
}
