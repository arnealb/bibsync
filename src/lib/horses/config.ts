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

/** Replay animation length (cosmetic only — the winner is already drawn). */
export const RACE_REPLAY_MS = 13_000;
