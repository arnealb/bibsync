import { WHEEL_SEGMENTS, type WheelRisk } from "@/lib/wheel/config";

/** Pure, server-authoritative Wheel math. No persistence here. */

export interface WheelResult {
  risk: WheelRisk;
  /** Index of the landed segment. */
  index: number;
  multiplier: number;
  bet: number;
  payout: number;
}

export function wheelSegments(risk: WheelRisk): number[] {
  return WHEEL_SEGMENTS[risk];
}

/** Pick a landed segment index uniformly. `rng` is `() => number` in [0,1). */
export function spinWheel(risk: WheelRisk, rng: () => number): number {
  const n = WHEEL_SEGMENTS[risk].length;
  return Math.min(n - 1, Math.floor(rng() * n));
}

/** Whole-bibcoin payout for landing on `index` (floored). */
export function wheelPayout(
  bet: number,
  risk: WheelRisk,
  index: number,
): number {
  return Math.floor(bet * WHEEL_SEGMENTS[risk][index]);
}
