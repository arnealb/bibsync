import {
  HORSE_COUNT,
  HORSES_MIN_WIN_BP,
  HORSES_MULT_CAP_BP,
  PODIUM_SPLIT_BP,
  STRENGTH_WEIGHTS,
  WEIGHT_EXPONENT,
  type HorseColor,
} from "@/lib/horses/config";
import { HORSE_NAME_POOL } from "@/lib/horses/names";

/**
 * Pure horse-race engine. The odds math MIRRORS `open_horse_race()` in
 * migration 0066 (SQL authoritative) and is unit-tested for EV ≤ stake; the
 * replay script is cosmetic — the winner is already drawn server-side, the
 * client only animates a deterministic race towards that result.
 */

export interface HorseStats {
  speed: number;
  stamina: number;
  sprint: number;
}

export interface RaceHorse extends HorseStats {
  color: HorseColor;
  winBp: number;
  /** Payout odds (bp) for finishing 1st / 2nd / 3rd. Races opened before the
   *  podium migration have their legacy win-only odds in mult1Bp and 0 for
   *  the places. */
  mult1Bp: number;
  mult2Bp: number;
  mult3Bp: number;
}

export interface HorseRace {
  id: number;
  runsAt: string;
  status: "open" | "resolved";
  horses: RaceHorse[];
  nameSeed: number;
  runSeed: number | null;
  winnerIdx: number | null;
  /** Full finishing order (horse indexes, winner first); null pre-podium. */
  finishOrder: number[] | null;
}

/** Cosmetic order for legacy races that only stored a winner. */
export function legacyFinishOrder(
  winnerIdx: number,
  count = HORSE_COUNT,
): number[] {
  return [
    winnerIdx,
    ...Array.from({ length: count }, (_, i) => i).filter(
      (i) => i !== winnerIdx,
    ),
  ];
}

export function horseStrength(h: HorseStats): number {
  return (
    STRENGTH_WEIGHTS.speed * h.speed +
    STRENGTH_WEIGHTS.stamina * h.stamina +
    STRENGTH_WEIGHTS.sprint * h.sprint
  );
}

/**
 * Win chances in basis points from the horses' strengths — mirror of the SQL:
 * weight = strength⁴ normalised to 10000, the last horse absorbs rounding,
 * and sub-floor longshots are bumped to HORSES_MIN_WIN_BP at the favourite's
 * expense (the first maximum, exactly like the SQL's strict `>` scan).
 */
export function winBpsFromStrengths(strengths: number[]): number[] {
  const weights = strengths.map((s) => Math.pow(s, WEIGHT_EXPONENT));
  const sum = weights.reduce((a, b) => a + b, 0);

  const win = weights.map((w) => Math.floor((10000 * w) / sum));
  win[win.length - 1] =
    10000 - win.slice(0, -1).reduce((a, b) => a + b, 0);

  let maxIdx = 0;
  for (let i = 1; i < win.length; i++) {
    if (win[i] > win[maxIdx]) maxIdx = i;
  }
  let short = 0;
  const floored = win.map((bp) => {
    if (bp >= HORSES_MIN_WIN_BP) return bp;
    short += HORSES_MIN_WIN_BP - bp;
    return HORSES_MIN_WIN_BP;
  });
  return floored.map((bp, i) => (i === maxIdx ? bp - short : bp));
}

export interface PlaceProbs {
  p1: number;
  p2: number;
  p3: number;
}

/**
 * Exact podium probabilities per horse under the Plackett–Luce model the
 * resolver samples from (sequential weighted draws without replacement, with
 * the stored winBp as weights) — mirror of `open_horse_race()`.
 */
export function placeProbabilities(winBps: number[]): PlaceProbs[] {
  const W = 10000;
  return winBps.map((wi, i) => {
    const p1 = wi / W;
    let p2 = 0;
    let p3 = 0;
    for (let j = 0; j < winBps.length; j++) {
      if (j === i) continue;
      const wj = winBps[j];
      p2 += (wj / W) * (wi / (W - wj));
      for (let k = 0; k < winBps.length; k++) {
        if (k === i || k === j) continue;
        const wk = winBps[k];
        p3 += (wj / W) * (wk / (W - wj)) * (wi / (W - wj - wk));
      }
    }
    return { p1, p2, p3 };
  });
}

export interface PodiumMults {
  mult1Bp: number;
  mult2Bp: number;
  mult3Bp: number;
}

/**
 * Fixed odds per podium spot (bp) — mirror of the SQL: α_k / P(k-th), floored
 * and capped, so EV = Σ α_k = 95% of the stake exactly (before flooring).
 */
export function podiumMultBps(winBps: number[]): PodiumMults[] {
  const cap = (x: number) => Math.min(Math.floor(x), HORSES_MULT_CAP_BP);
  return placeProbabilities(winBps).map(({ p1, p2, p3 }) => ({
    mult1Bp: cap(PODIUM_SPLIT_BP.win / p1),
    mult2Bp: cap(PODIUM_SPLIT_BP.second / p2),
    mult3Bp: cap(PODIUM_SPLIT_BP.third / p3),
  }));
}

/**
 * Full finishing order via sequential weighted draws without replacement —
 * mirror of the resolver in `run_horse_races()`. Used by the EV tests to
 * prove the sampler matches {@link placeProbabilities}.
 */
export function drawFinishOrder(
  rng: () => number,
  winBps: number[],
): number[] {
  const remaining = winBps.map((_, i) => i);
  const order: number[] = [];
  while (remaining.length > 0) {
    const total = remaining.reduce((sum, i) => sum + winBps[i], 0);
    const pick = rng() * total;
    let acc = 0;
    for (let j = 0; j < remaining.length; j++) {
      acc += winBps[remaining[j]];
      if (pick < acc) {
        order.push(remaining[j]);
        remaining.splice(j, 1);
        break;
      }
    }
  }
  return order;
}

/** Floored payout — can never exceed amount × multiplier. */
export function horsePayout(amount: number, multBp: number): number {
  return Math.floor((amount * multBp) / 10000);
}

/** "×5.7" display label for a multiplier in bp. */
export function multLabel(multBp: number): string {
  return (multBp / 10000).toLocaleString("nl-BE", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

/** Deterministic PRNG — same seed, same race replay on every client. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Six distinct names for a race, drawn deterministically from its seed. */
export function horseNames(nameSeed: number): string[] {
  const rng = mulberry32(nameSeed);
  const pool = [...HORSE_NAME_POOL];
  const names: string[] = [];
  for (let i = 0; i < HORSE_COUNT; i++) {
    const j = Math.floor(rng() * pool.length);
    names.push(pool.splice(j, 1)[0]);
  }
  return names;
}

export interface RaceScript {
  /** frames[t][horse] = track progress 0…1, monotonic; the winner hits 1 first. */
  frames: number[][];
  /** Horse indexes in finishing order (winner first). */
  finishOrder: number[];
}

const SCRIPT_STEPS = 96;
/** The winner crosses the line at this fraction of the race. */
const WINNER_FINISH_AT = 0.8;

/**
 * Deterministic race animation: per-horse speed noise (early segments lean on
 * speed, the middle on stamina, the end on sprint — flavour only) is
 * normalised so the horses cross the line in exactly the drawn finishing
 * order, with seeded gaps (squared draw → photo finishes are common).
 */
export function raceScript(
  runSeed: number,
  horses: HorseStats[],
  finishOrder: number[],
): RaceScript {
  const rng = mulberry32(runSeed);
  const last = SCRIPT_STEPS - 1;

  const cums = horses.map((h) => {
    const cum: number[] = [0];
    for (let t = 1; t < SCRIPT_STEPS; t++) {
      const phase = t / last;
      const stat = phase < 0.33 ? h.speed : phase < 0.66 ? h.stamina : h.sprint;
      const v = 0.6 + 0.8 * ((stat - 40) / 59) + 0.9 * rng();
      cum.push(cum[t - 1] + v);
    }
    return cum;
  });

  // Crossing step per horse, walking the stored order with seeded gaps. The
  // podium gaps stay small enough that 1st–3rd never clamp into a tie.
  const targets = horses.map(() => last);
  let step = Math.round(WINNER_FINISH_AT * last);
  finishOrder.forEach((horseIdx, pos) => {
    if (pos > 0) step += 2 + Math.round(4 * Math.pow(rng(), 2));
    targets[horseIdx] = Math.min(step, last);
  });

  const frames: number[][] = [];
  for (let t = 0; t < SCRIPT_STEPS; t++) {
    frames.push(
      horses.map((_, i) => Math.min(1, cums[i][t] / cums[i][targets[i]])),
    );
  }

  return { frames, finishOrder };
}

/** Interpolated progress of one horse at replay time t ∈ [0,1]. */
export function scriptProgressAt(
  script: RaceScript,
  horseIdx: number,
  t: number,
): number {
  const last = script.frames.length - 1;
  const pos = Math.min(Math.max(t, 0), 1) * last;
  const lo = Math.floor(pos);
  const hi = Math.min(lo + 1, last);
  const frac = pos - lo;
  const a = script.frames[lo][horseIdx];
  const b = script.frames[hi][horseIdx];
  return a + (b - a) * frac;
}

/** Index of the horse in the lead at replay time t (for commentary). */
export function leaderAt(script: RaceScript, t: number): number {
  let best = 0;
  for (let i = 1; i < script.frames[0].length; i++) {
    if (scriptProgressAt(script, i, t) > scriptProgressAt(script, best, t)) {
      best = i;
    }
  }
  return best;
}
