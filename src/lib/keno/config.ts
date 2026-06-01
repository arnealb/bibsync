/** Keno tuning. Pick up to 10 of 40 numbers; the house draws 10. The paytable
 *  is generated from the hypergeometric distribution so the RTP per pick-count
 *  is a fixed ~0.95 (≈5% edge) — no hand-tuned numbers to get wrong. */

export const KENO_POOL = 40;
export const KENO_DRAW = 10;
export const KENO_MAX_PICKS = 10;

export const KENO_MIN_BET = 10;
export const KENO_MAX_BET = 1_000_000;
export const KENO_CHIPS = [10, 50, 100, 500] as const;

const TARGET_RTP = 0.95;
const MAX_MULT = 25_000;

/** Binomial C(n, r). */
function choose(n: number, r: number): number {
  if (r < 0 || r > n) return 0;
  const k = Math.min(r, n - r);
  let c = 1;
  for (let i = 0; i < k; i++) c = (c * (n - i)) / (i + 1);
  return c;
}

/** Hypergeometric P(hits = h | picks = k, draws = KENO_DRAW, pool = KENO_POOL). */
export function hyperProb(k: number, h: number): number {
  return (
    (choose(k, h) * choose(KENO_POOL - k, KENO_DRAW - h)) /
    choose(KENO_POOL, KENO_DRAW)
  );
}

/**
 * Multiplier per hit-count for `picks` numbers. Rare/high-hit results pay more
 * (weight ∝ h²), scaled so the expected return is exactly TARGET_RTP before the
 * floor/cap (which only lower it — the edge always holds).
 */
function buildPaytable(picks: number): number[] {
  const payMin = Math.max(1, Math.floor(picks / 4));
  const paying: number[] = [];
  for (let h = payMin; h <= picks && h <= KENO_DRAW; h++) paying.push(h);

  const denom = paying.reduce((sum, h) => sum + hyperProb(picks, h) * h * h, 0);
  const table = new Array<number>(picks + 1).fill(0);
  if (denom <= 0) return table;
  for (const h of paying) {
    const raw = Math.min(MAX_MULT, (TARGET_RTP * h * h) / denom);
    table[h] = Math.floor(raw * 10) / 10; // floor → RTP ≤ target
  }
  return table;
}

/** Paytable per pick-count (1..10): `KENO_PAYTABLE[picks][hits]` → multiplier. */
export const KENO_PAYTABLE: number[][] = [
  [],
  ...Array.from({ length: KENO_MAX_PICKS }, (_, i) => buildPaytable(i + 1)),
];
