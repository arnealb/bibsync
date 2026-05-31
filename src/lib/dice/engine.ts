import {
  DICE_HOUSE_EDGE,
  DICE_OUTCOMES,
  type DiceDirection,
} from "@/lib/dice/config";

/** Pure, server-authoritative Dice math. No persistence here. */

export interface DiceResult {
  /** Target threshold in basis points (e.g. 5050 = 50.50). */
  targetBp: number;
  direction: DiceDirection;
  /** The roll, 0..9999 (= 0.00..99.99). */
  roll: number;
  win: boolean;
  multiplier: number;
  bet: number;
  payout: number;
}

/**
 * Win probability (0..1). `under` wins on roll < target, `over` on roll ≥
 * target — complementary, so every roll is a decisive win or loss.
 */
export function diceWinChance(
  targetBp: number,
  direction: DiceDirection,
): number {
  const winning = direction === "under" ? targetBp : DICE_OUTCOMES - targetBp;
  return winning / DICE_OUTCOMES;
}

/**
 * Payout multiplier: fair odds (1 / win-chance) shaved by the house edge.
 * Derived from the *actual* discrete win chance, so `floor`-ed payouts can
 * never beat the edge.
 */
export function diceMultiplier(
  targetBp: number,
  direction: DiceDirection,
): number {
  return (1 - DICE_HOUSE_EDGE) / diceWinChance(targetBp, direction);
}

/** Roll an integer 0..9999 from an RNG in [0, 1). */
export function rollDice(rng: () => number): number {
  return Math.min(DICE_OUTCOMES - 1, Math.floor(rng() * DICE_OUTCOMES));
}

/** Did `roll` win? `under`: roll < target; `over`: roll ≥ target. */
export function diceWin(
  roll: number,
  targetBp: number,
  direction: DiceDirection,
): boolean {
  return direction === "under" ? roll < targetBp : roll >= targetBp;
}

/** Whole-bibcoin payout on a win (floored — fractional winnings to the house). */
export function dicePayout(
  bet: number,
  targetBp: number,
  direction: DiceDirection,
): number {
  return Math.floor(bet * diceMultiplier(targetBp, direction));
}
