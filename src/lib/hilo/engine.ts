/** Pure Hi-Lo (hoger/lager) math. No persistence here.
 *  Cards are ranks 2..14 (J=11, Q=12, K=13, A=14), drawn uniformly with
 *  replacement. A tie counts as a loss for the chosen side. */

export const HILO_HOUSE_EDGE = 0.01;
export const HILO_MIN_CARD = 2;
export const HILO_MAX_CARD = 14;
export const HILO_RANKS = HILO_MAX_CARD - HILO_MIN_CARD + 1; // 13

export type HiloDirection = "higher" | "lower";
export type HiloStatus = "active" | "busted" | "cashed";

export interface HiloState {
  /** Unique per game — keeps the cash-out payout ref unique across games. */
  id: string;
  status: HiloStatus;
  bet: number;
  /** The face-up card you're guessing against (2..14). */
  current: number;
  /** Running multiplier (product of each correct guess's factor). */
  multiplier: number;
  /** Number of correct guesses so far. */
  streak: number;
  /** The card revealed on a bust (else null). */
  revealed: number | null;
  payout: number;
}

/** Draw a card 2..14 uniformly. `rng` is `() => number` in [0, 1). */
export function drawCard(rng: () => number): number {
  return HILO_MIN_CARD + Math.min(HILO_RANKS - 1, Math.floor(rng() * HILO_RANKS));
}

/** How many ranks satisfy a guess against `card` (ties excluded). */
export function winCount(direction: HiloDirection, card: number): number {
  return direction === "higher" ? HILO_MAX_CARD - card : card - HILO_MIN_CARD;
}

/** Win probability (0..1) of a guess against `card`. */
export function winChance(direction: HiloDirection, card: number): number {
  return winCount(direction, card) / HILO_RANKS;
}

/**
 * Multiplier factor a correct guess earns: fair odds shaved by the house edge.
 * Returns 0 when the guess is impossible (a guaranteed loss) — that option is
 * disabled.
 */
export function optionMultiplier(
  direction: HiloDirection,
  card: number,
): number {
  const w = winCount(direction, card);
  if (w <= 0) return 0;
  return (1 - HILO_HOUSE_EDGE) / (w / HILO_RANKS);
}

/** Did the guess win? `higher` needs next > current, `lower` next < current. */
export function guessWins(
  direction: HiloDirection,
  current: number,
  next: number,
): boolean {
  return direction === "higher" ? next > current : next < current;
}

/** Whole-bibcoin payout for cashing out (floored). */
export function hiloPayout(bet: number, multiplier: number): number {
  return Math.floor(bet * multiplier);
}

/** Card face label (Dutch court cards). */
export function cardLabel(card: number): string {
  if (card === 11) return "B";
  if (card === 12) return "V";
  if (card === 13) return "H";
  if (card === 14) return "A";
  return String(card);
}
