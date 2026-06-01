import { KENO_DRAW, KENO_PAYTABLE, KENO_POOL } from "@/lib/keno/config";

/** Pure, server-authoritative Keno math. No persistence here. */

export interface KenoResult {
  picks: number[];
  drawn: number[];
  hits: number[];
  multiplier: number;
  bet: number;
  payout: number;
}

/** Draw KENO_DRAW distinct numbers (1..KENO_POOL) via a partial Fisher–Yates. */
export function drawKeno(rng: () => number): number[] {
  const deck = Array.from({ length: KENO_POOL }, (_, i) => i + 1);
  for (let i = 0; i < KENO_DRAW; i++) {
    const j = i + Math.floor(rng() * (KENO_POOL - i));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck.slice(0, KENO_DRAW).sort((a, b) => a - b);
}

/** The picks that were drawn. */
export function kenoHits(picks: number[], drawn: number[]): number[] {
  const set = new Set(drawn);
  return picks.filter((p) => set.has(p));
}

/** Multiplier for `picks` numbers with `hits` matches. */
export function kenoMultiplier(picks: number, hits: number): number {
  return KENO_PAYTABLE[picks]?.[hits] ?? 0;
}

/** Whole-bibcoin payout (floored). */
export function kenoPayout(bet: number, picks: number, hits: number): number {
  return Math.floor(bet * kenoMultiplier(picks, hits));
}
