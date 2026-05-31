import { MINES_GRID_SIZE, MINES_HOUSE_EDGE } from "@/lib/mines/config";

/** Pure, server-authoritative Mines math. No persistence here. */

export type MinesStatus = "active" | "busted" | "cashed";

export interface MinesState {
  /** Unique per game — keeps the cash-out payout ref from colliding across
   *  games (the row's `version` resets to 0 each game, so it can't be used). */
  id: string;
  status: MinesStatus;
  /** Bibcoins staked when the game started. */
  bet: number;
  /** Number of bombs hidden on the board. */
  mineCount: number;
  /** Safe tiles the player has opened (in click order). */
  revealed: number[];
  /** Bomb positions — only disclosed once the game is over (else null). */
  mines: number[] | null;
  /** The bomb that ended the game (busted only). */
  bust: number | null;
  /** Multiplier for the current number of revealed tiles. */
  multiplier: number;
  /** Bibcoins paid out (cashed only; 0 otherwise). */
  payout: number;
}

/** Non-bomb tiles on the board. */
export function safeTileCount(mineCount: number): number {
  return MINES_GRID_SIZE - mineCount;
}

/**
 * Cash-out multiplier after opening `revealed` safe tiles from a board with
 * `mineCount` bombs. `revealed === 0` → 1 (you'd only get your stake back).
 *
 * The chance of opening `revealed` safe tiles in a row is
 *   C(N - mineCount, revealed) / C(N, revealed),
 * so the fair payout is its inverse — which telescopes to the product below.
 * We then shave the house edge off.
 */
export function minesMultiplier(mineCount: number, revealed: number): number {
  if (revealed <= 0) return 1;
  const n = MINES_GRID_SIZE;
  let fair = 1;
  for (let i = 0; i < revealed; i++) {
    fair *= (n - i) / (n - mineCount - i);
  }
  return Math.round((1 - MINES_HOUSE_EDGE) * fair * 100) / 100;
}

/**
 * Whole-bibcoin payout for cashing out at `revealed` safe tiles. Floors (the
 * casino convention: fractional winnings go to the house). This matters: with
 * `round`, a player could pick bet sizes where `round(bet × multiplier)` rounds
 * up enough to beat the ~1% edge on a near-certain single reveal — a +EV
 * exploit. `floor` keeps payout ≤ bet × multiplier, so the edge always holds.
 */
export function minesPayout(
  bet: number,
  mineCount: number,
  revealed: number,
): number {
  return Math.floor(bet * minesMultiplier(mineCount, revealed));
}

/**
 * Pick `mineCount` distinct tile indices in [0, N) using the supplied RNG
 * (`() => number` in [0, 1)). Pure given the RNG; uses a partial Fisher–Yates
 * shuffle over a fresh local array (no shared state mutated).
 */
export function generateMines(mineCount: number, rng: () => number): number[] {
  const n = MINES_GRID_SIZE;
  const count = Math.min(Math.max(mineCount, 0), n);
  const deck = Array.from({ length: n }, (_, i) => i);
  for (let i = 0; i < count; i++) {
    const j = i + Math.floor(rng() * (n - i));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck.slice(0, count).sort((a, b) => a - b);
}
