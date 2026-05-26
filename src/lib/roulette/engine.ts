/** European single-zero roulette (0–36). Pure logic; the winning number is
 *  picked server-side. */

/** Physical wheel order, used for the spinning animation. */
export const WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24,
  16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];

export const RED_NUMBERS = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

export type RouletteColor = "red" | "black" | "green";

export function colorOf(n: number): RouletteColor {
  if (n === 0) return "green";
  return RED_NUMBERS.has(n) ? "red" : "black";
}

export type BetType =
  | "straight"
  | "red"
  | "black"
  | "even"
  | "odd"
  | "low"
  | "high"
  | "dozen1"
  | "dozen2"
  | "dozen3"
  | "col1"
  | "col2"
  | "col3";

export interface Bet {
  type: BetType;
  /** Only for "straight" bets: the chosen number 0–36. */
  value?: number;
  amount: number;
}

function wins(bet: Bet, n: number): boolean {
  if (bet.type === "straight") return bet.value === n;
  if (n === 0) return false; // zero loses every outside bet
  switch (bet.type) {
    case "red":
      return colorOf(n) === "red";
    case "black":
      return colorOf(n) === "black";
    case "even":
      return n % 2 === 0;
    case "odd":
      return n % 2 === 1;
    case "low":
      return n >= 1 && n <= 18;
    case "high":
      return n >= 19 && n <= 36;
    case "dozen1":
      return n >= 1 && n <= 12;
    case "dozen2":
      return n >= 13 && n <= 24;
    case "dozen3":
      return n >= 25 && n <= 36;
    case "col1":
      return n % 3 === 1;
    case "col2":
      return n % 3 === 2;
    case "col3":
      return n % 3 === 0;
  }
}

/** Amount returned to the wallet for a bet (includes the stake), 0 if it loses. */
export function payoutFor(bet: Bet, n: number): number {
  if (!wins(bet, n)) return 0;
  if (bet.type === "straight") return bet.amount * 36; // 35:1 + stake
  if (
    bet.type === "dozen1" ||
    bet.type === "dozen2" ||
    bet.type === "dozen3" ||
    bet.type === "col1" ||
    bet.type === "col2" ||
    bet.type === "col3"
  ) {
    return bet.amount * 3; // 2:1 + stake
  }
  return bet.amount * 2; // even money + stake
}

export function totalPayout(bets: Bet[], n: number): number {
  return bets.reduce((sum, bet) => sum + payoutFor(bet, n), 0);
}

/** Picks a winning number 0–36 from an injected RNG (∈ [0,1)). */
export function pickNumber(rng: () => number): number {
  return Math.min(36, Math.floor(rng() * 37));
}
