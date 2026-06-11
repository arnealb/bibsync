/**
 * Paardenraces tuning. MIRROR of `open_horse_race()` /
 * `place_horse_bet()` in `supabase/migrations/0066_horse_races.sql` —
 * the SQL is authoritative; keep both in sync when tuning.
 */

export const HORSE_COUNT = 6;

/** Lane order is fixed; the colour IS the horse's identity. */
export const HORSE_COLORS = [
  "red",
  "blue",
  "green",
  "yellow",
  "purple",
  "orange",
] as const;
export type HorseColor = (typeof HORSE_COLORS)[number];

/** Uniform house edge baked into every horse's odds (basis points). */
export const HORSES_EDGE_BP = 500;

/**
 * How the returned 95% splits across the podium (basis points, summing to
 * 10000 − edge): a bet pays α_k / P(finish k-th) on each podium spot, so the
 * total EV is exactly 95% of the stake for every horse.
 */
export const PODIUM_SPLIT_BP = { win: 7000, second: 1500, third: 1000 } as const;

/** Win chances are floored here (taken from the favourite) so longshot odds
 *  keep the same edge instead of silently worsening. */
export const HORSES_MIN_WIN_BP = 200;

/** Sanity cap on the payout multiplier (×50) — never binds after the floor. */
export const HORSES_MULT_CAP_BP = 500_000;

/** Stats roll uniformly in this range. */
export const HORSE_STAT_MIN = 40;
export const HORSE_STAT_MAX = 99;

/** strength = 0.45·speed + 0.35·stamina + 0.20·sprint; chance ∝ strength⁴. */
export const STRENGTH_WEIGHTS = { speed: 0.45, stamina: 0.35, sprint: 0.2 };
export const WEIGHT_EXPONENT = 4;

export const HORSES_MIN_BET = 10;
export const HORSES_MAX_BET = 5000;
export const HORSES_CHIPS = [25, 100, 250, 1000] as const;

/**
 * The live race runs exactly one minute, anchored to the race's `runs_at`
 * wall clock — every client sees the same race at the same moment. Cosmetic
 * only: the finish order is already drawn at :00 (betting is closed by then).
 */
export const RACE_DURATION_MS = 60_000;

/** Manual replays run faster than the live minute. */
export const RACE_REPLAY_MS = 15_000;

/** How long the finished live track lingers before giving way to results. */
export const LIVE_LINGER_MS = 8_000;
