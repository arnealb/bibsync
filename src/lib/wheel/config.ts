/** Wheel-of-fortune tuning. Each risk is a list of equal-probability segments;
 *  the wheel lands on one uniformly, so RTP = the mean multiplier (~0.975). */

export const WHEEL_RISKS = ["low", "medium", "high"] as const;
export type WheelRisk = (typeof WHEEL_RISKS)[number];

export const WHEEL_MIN_BET = 10;
export const WHEEL_MAX_BET = 1_000_000;
export const WHEEL_CHIPS = [10, 50, 100, 500] as const;

/** Evenly spread a [multiplier, count] spec around the wheel (no colour
 *  clustering). Each step every pool gains count/N; the highest-credit pool
 *  emits and drops by 1 — a standard even-distribution. */
function build(spec: [number, number][]): number[] {
  const total = spec.reduce((sum, [, c]) => sum + c, 0);
  const pools = spec.map(([m, c]) => ({ m, count: c, acc: 0 }));
  const out: number[] = [];
  for (let k = 0; k < total; k++) {
    let best = pools[0];
    for (const p of pools) {
      p.acc += p.count / total;
      if (p.acc > best.acc) best = p;
    }
    out.push(best.m);
    best.acc -= 1;
  }
  return out;
}

/** 20-segment wheels per risk (mean ≈ 0.975 → ~2.5% house edge). */
export const WHEEL_SEGMENTS: Record<WheelRisk, number[]> = {
  low: build([
    [1.5, 13],
    [0, 7],
  ]),
  medium: build([
    [0, 11],
    [1.5, 5],
    [2, 2],
    [3, 1],
    [5, 1],
  ]),
  high: build([
    [0, 16],
    [2, 1],
    [3, 1],
    [5, 1],
    [9.5, 1],
  ]),
};

/** Colour for a segment by multiplier (for the wheel + labels). */
export function wheelColor(multiplier: number): string {
  if (multiplier === 0) return "#dc2626"; // red — lose
  if (multiplier < 2) return "#10b981"; // emerald
  if (multiplier < 5) return "#0ea5e9"; // sky
  if (multiplier < 10) return "#a855f7"; // violet
  return "#f59e0b"; // amber — jackpot
}
