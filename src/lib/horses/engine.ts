import {
  HORSE_COUNT,
  HORSES_EDGE_BP,
  HORSES_MIN_WIN_BP,
  HORSES_MULT_CAP_BP,
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
  multBp: number;
}

export interface HorseRace {
  id: number;
  runsAt: string;
  status: "open" | "resolved";
  horses: RaceHorse[];
  nameSeed: number;
  runSeed: number | null;
  winnerIdx: number | null;
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

/** Fixed-odds multiplier (bp) for a win chance — mirror of the SQL. */
export function multBpFromWinBp(winBp: number): number {
  return Math.min(
    Math.floor(((10000 - HORSES_EDGE_BP) * 10000) / winBp),
    HORSES_MULT_CAP_BP,
  );
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
/** The winner crosses the line at this fraction of the replay. */
const WINNER_FINISH_AT = 0.88;

/**
 * Deterministic replay: per-horse speed noise (early segments lean on speed,
 * the middle on stamina, the end on sprint — flavour only) is normalised so
 * the drawn winner finishes first, with losers a seeded margin behind
 * (squared draw → photo finishes are common).
 */
export function raceScript(
  runSeed: number,
  horses: HorseStats[],
  winnerIdx: number,
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

  // Step at which each horse crosses the line; the winner's is strictly first.
  const targets = horses.map((_, i) => {
    if (i === winnerIdx) return Math.round(WINNER_FINISH_AT * last);
    const margin = 0.02 + 0.24 * Math.pow(rng(), 2);
    return Math.min(last, Math.round(WINNER_FINISH_AT * (1 + margin) * last));
  });

  const frames: number[][] = [];
  for (let t = 0; t < SCRIPT_STEPS; t++) {
    frames.push(
      horses.map((_, i) => Math.min(1, cums[i][t] / cums[i][targets[i]])),
    );
  }

  const finishOrder = horses
    .map((_, i) => i)
    .sort((a, b) =>
      a === winnerIdx ? -1 : b === winnerIdx ? 1 : targets[a] - targets[b],
    );

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
