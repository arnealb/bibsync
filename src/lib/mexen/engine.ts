import { MEXEN_RANK_DOUBLE_BASE, MEXEN_RANK_MEXEN } from "@/lib/mexen/config";

/**
 * Pure, server-authoritative Mexen scoring. No persistence, no Dutch copy —
 * the engine returns structured data the UI composes messages from.
 *
 * Two dice are read as a two-digit number: the higher pip is the tens, the
 * lower the units (5 & 1 → 51, 2 & 1 → 21). Ranking, high → low:
 *   1. Mexen (21)          — the single highest throw
 *   2. Doubles 66…11       — every double outranks every normal number
 *   3. Normal numbers 65…31
 */

export type DiePair = readonly [number, number];

export type ThrowCategory = "mexen" | "double" | "normal";

export interface ThrowScore {
  /** The two pips exactly as rolled. */
  dice: [number, number];
  /** Higher / lower pip. */
  hi: number;
  lo: number;
  /** Two-digit reading (e.g. 65, 21, 33). */
  number: number;
  /** Strict ordering key — higher wins. */
  rank: number;
  category: ThrowCategory;
  /** The repeated pip for a double, else null. */
  pip: number | null;
  isMexen: boolean;
  isDouble: boolean;
  /** 31 — the lowest normal number; lets the thrower deal out a half atje. */
  is31: boolean;
  /** 11 — snake eyes; the first thrower becomes "honderdman". */
  isSnakeEyes: boolean;
}

/** Roll a single die 1..6 from an RNG in [0, 1). */
export function rollDie(rng: () => number): number {
  return 1 + Math.min(5, Math.floor(rng() * 6));
}

/** Roll a fresh pair of dice. */
export function rollPair(rng: () => number): [number, number] {
  return [rollDie(rng), rollDie(rng)];
}

/** Score a (possibly partially re-rolled) pair of dice. */
export function scoreThrow(dice: DiePair): ThrowScore {
  const [a, b] = dice;
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  const number = hi * 10 + lo;

  const isMexen = hi === 2 && lo === 1;
  const isDouble = a === b;

  let rank: number;
  let category: ThrowCategory;
  if (isMexen) {
    rank = MEXEN_RANK_MEXEN;
    category = "mexen";
  } else if (isDouble) {
    rank = MEXEN_RANK_DOUBLE_BASE + a;
    category = "double";
  } else {
    rank = number;
    category = "normal";
  }

  return {
    dice: [a, b],
    hi,
    lo,
    number,
    rank,
    category,
    pip: isDouble ? a : null,
    isMexen,
    isDouble,
    is31: number === 31,
    isSnakeEyes: isDouble && a === 1,
  };
}

/** Compare two throws: positive when `a` beats `b`, 0 on a tie. */
export function compareThrows(a: ThrowScore, b: ThrowScore): number {
  return a.rank - b.rank;
}

/** Drink / status effects a single throw triggers, given the honderdman state. */
export interface ThrowEffects {
  /** Snake eyes (11) while nobody is honderdman yet → this thrower becomes it. */
  makesHonderdman: boolean;
  /** Sips the thrower drinks themselves (a double → the pip count). */
  drinkSips: number;
  /** Sips the current honderdman drinks (any double once one exists). */
  honderdmanDrinksSips: number;
  /** 31 → the thrower may deal out a half atje. */
  dealHalf: boolean;
  /** 21 → Mexen. */
  mexen: boolean;
}

/**
 * Resolve the effects of a throw. `honderdmanExists` is the state *before* this
 * throw, so the snake-eyes that creates the honderdman doesn't also penalise
 * them for it.
 */
export function throwEffects(
  score: ThrowScore,
  honderdmanExists: boolean,
): ThrowEffects {
  return {
    makesHonderdman: score.isSnakeEyes && !honderdmanExists,
    drinkSips: score.isDouble ? (score.pip ?? 0) : 0,
    honderdmanDrinksSips:
      score.isDouble && honderdmanExists ? (score.pip ?? 0) : 0,
    dealHalf: score.is31,
    mexen: score.isMexen,
  };
}

export interface PlayerThrow {
  playerId: string;
  score: ThrowScore;
}

export interface RoundOutcome {
  /** Players tied at the lowest rank — they drink (and pay, when betting). */
  loserIds: string[];
  /** Players tied at the highest rank. */
  winnerIds: string[];
  /** Atjes the loser owes: 2 when the winning throw is a Mexen, else 1. */
  loserAtjes: number;
}

/** Resolve a finished round from every player's final throw. */
export function roundOutcome(throws: PlayerThrow[]): RoundOutcome {
  if (throws.length === 0) {
    return { loserIds: [], winnerIds: [], loserAtjes: 1 };
  }
  const ranks = throws.map((t) => t.score.rank);
  const max = Math.max(...ranks);
  const min = Math.min(...ranks);
  const winnerIds = throws.filter((t) => t.score.rank === max).map((t) => t.playerId);
  const loserIds = throws.filter((t) => t.score.rank === min).map((t) => t.playerId);
  return {
    winnerIds,
    loserIds,
    loserAtjes: max === MEXEN_RANK_MEXEN ? 2 : 1,
  };
}
