/** Wheel-of-fortune tuning. Each risk is a list of equal-probability segments;
 *  the wheel lands on one uniformly, so RTP = the mean multiplier (~0.975). */

export const WHEEL_RISKS = ["low", "medium", "high"] as const;
export type WheelRisk = (typeof WHEEL_RISKS)[number];

export const WHEEL_MIN_BET = 10;
export const WHEEL_MAX_BET = 1_000_000;
export const WHEEL_CHIPS = [10, 50, 100, 500] as const;

/** Round-robin a [multiplier, count] spec into an interleaved segment list. */
function build(spec: [number, number][]): number[] {
  const pools = spec.map(([m, c]) => ({ m, c }));
  const out: number[] = [];
  let remaining = pools.reduce((sum, p) => sum + p.c, 0);
  while (remaining > 0) {
    for (const p of pools) {
      if (p.c > 0) {
        out.push(p.m);
        p.c -= 1;
        remaining -= 1;
      }
    }
  }
  return out;
}

/** 20-segment wheels per risk (mean ≈ 0.975 → ~2.5% house edge). */
export const WHEEL_SEGMENTS: Record<WheelRisk, number[]> = {
  low: build([
    [1.2, 10],
    [1.5, 5],
    [0, 5],
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
