import { cardSuit, cardValue, type Card } from "@/lib/poker/cards";

/**
 * Poker hand strength as a comparable value:
 *  - `category`: 0 high card … 8 straight flush (higher beats lower)
 *  - `tiebreak`: rank values that break ties within a category, most
 *    significant first. Compared lexicographically.
 */
export interface HandValue {
  category: number;
  tiebreak: number[];
}

export const HAND_CATEGORY = {
  HIGH_CARD: 0,
  PAIR: 1,
  TWO_PAIR: 2,
  TRIPS: 3,
  STRAIGHT: 4,
  FLUSH: 5,
  FULL_HOUSE: 6,
  QUADS: 7,
  STRAIGHT_FLUSH: 8,
} as const;

const CATEGORY_LABEL: Record<number, string> = {
  0: "Hoge kaart",
  1: "Paar",
  2: "Twee paar",
  3: "Drie gelijk",
  4: "Straat",
  5: "Flush",
  6: "Full house",
  7: "Vier gelijk",
  8: "Straight flush",
};

/** Dutch label for a hand value (royal flush is called out). */
export function handLabel(value: HandValue): string {
  if (
    value.category === HAND_CATEGORY.STRAIGHT_FLUSH &&
    value.tiebreak[0] === 14
  ) {
    return "Royal flush";
  }
  return CATEGORY_LABEL[value.category];
}

/** >0 if a is stronger, <0 if b is stronger, 0 if exactly equal. */
export function compareHands(a: HandValue, b: HandValue): number {
  if (a.category !== b.category) return a.category - b.category;
  const len = Math.max(a.tiebreak.length, b.tiebreak.length);
  for (let i = 0; i < len; i++) {
    const diff = (a.tiebreak[i] ?? 0) - (b.tiebreak[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * Highest straight high-card present in the rank set, or 0 if none.
 * Handles the wheel (A-2-3-4-5 → high card 5).
 */
function straightHigh(uniqueDesc: number[]): number {
  const present = new Set(uniqueDesc);
  // Ace plays low for the wheel.
  const withWheel = present.has(14) ? [...present, 1] : [...present];
  const sorted = [...new Set(withWheel)].sort((a, b) => b - a);
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1] - 1) {
      run += 1;
      // sorted[i-4..i] are five consecutive values; the highest is sorted[i-4].
      if (run >= 5) return sorted[i - 4];
    } else {
      run = 1;
    }
  }
  return 0;
}

/** Evaluate exactly five cards. */
export function evaluate5(cards: Card[]): HandValue {
  const values = cards.map(cardValue).sort((a, b) => b - a);
  const suits = cards.map(cardSuit);
  const isFlush = suits.every((s) => s === suits[0]);

  // Count occurrences per rank value.
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);

  // Groups sorted by (count desc, value desc) — drives most tiebreaks.
  const groups = [...counts.entries()].sort((a, b) =>
    b[1] - a[1] !== 0 ? b[1] - a[1] : b[0] - a[0],
  );

  const uniqueDesc = [...counts.keys()].sort((a, b) => b - a);
  const straight = straightHigh(uniqueDesc);

  if (isFlush && straight) {
    return { category: HAND_CATEGORY.STRAIGHT_FLUSH, tiebreak: [straight] };
  }
  if (groups[0][1] === 4) {
    const quad = groups[0][0];
    const kicker = values.find((v) => v !== quad)!;
    return { category: HAND_CATEGORY.QUADS, tiebreak: [quad, kicker] };
  }
  if (groups[0][1] === 3 && groups[1]?.[1] >= 2) {
    return {
      category: HAND_CATEGORY.FULL_HOUSE,
      tiebreak: [groups[0][0], groups[1][0]],
    };
  }
  if (isFlush) {
    return { category: HAND_CATEGORY.FLUSH, tiebreak: values };
  }
  if (straight) {
    return { category: HAND_CATEGORY.STRAIGHT, tiebreak: [straight] };
  }
  if (groups[0][1] === 3) {
    const trip = groups[0][0];
    const kickers = values.filter((v) => v !== trip);
    return { category: HAND_CATEGORY.TRIPS, tiebreak: [trip, ...kickers] };
  }
  if (groups[0][1] === 2 && groups[1]?.[1] === 2) {
    const hi = Math.max(groups[0][0], groups[1][0]);
    const lo = Math.min(groups[0][0], groups[1][0]);
    const kicker = values.find((v) => v !== hi && v !== lo)!;
    return { category: HAND_CATEGORY.TWO_PAIR, tiebreak: [hi, lo, kicker] };
  }
  if (groups[0][1] === 2) {
    const pair = groups[0][0];
    const kickers = values.filter((v) => v !== pair);
    return { category: HAND_CATEGORY.PAIR, tiebreak: [pair, ...kickers] };
  }
  return { category: HAND_CATEGORY.HIGH_CARD, tiebreak: values };
}

/** All k-combinations of the given items. */
function combinations<T>(items: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (k > items.length) return [];
  const [head, ...rest] = items;
  const withHead = combinations(rest, k - 1).map((c) => [head, ...c]);
  const withoutHead = combinations(rest, k);
  return [...withHead, ...withoutHead];
}

/** Best 5-card hand out of 5–7 cards. */
export function evaluate7(cards: Card[]): HandValue {
  if (cards.length < 5) {
    throw new Error("evaluate7 needs at least 5 cards");
  }
  if (cards.length === 5) return evaluate5(cards);
  let best: HandValue | null = null;
  for (const combo of combinations(cards, 5)) {
    const value = evaluate5(combo);
    if (!best || compareHands(value, best) > 0) best = value;
  }
  return best!;
}
