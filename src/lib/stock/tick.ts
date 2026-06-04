import {
  CRASH_CHANCE_HOURLY,
  CRASH_FACTOR_MAX,
  CRASH_FACTOR_MIN,
  MANAGEMENT_FEE_DAILY,
  NOISE_CLAMP,
  NOISE_SD_HOURLY,
  PROFIT_SKIM,
  RALLY_CHANCE_HOURLY,
  RALLY_FACTOR_MAX,
  RALLY_FACTOR_MIN,
} from "@/lib/stock/config";

/** Random draws for one tick, injected so the math stays deterministic. */
export interface TickRand {
  /** Standard-normal draw for the lognormal noise. */
  gauss: number;
  /** Event roll, uniform [0, 1). */
  roll: number;
  /** Event size draw, uniform [0, 1). */
  size: number;
}

export interface TickResult {
  treasury: number;
  event: "crash" | "rally" | null;
}

/**
 * One hourly volatility fold: profit skim → management fee → lognormal noise
 * (arithmetic mean 1, clamped) → crash/rally roll (EV-0). MIRROR of
 * `snapshot_casino_stock()` in `supabase/migrations/0062_stock_volatility.sql`
 * — SQL is authoritative; this exists for the EV guard tests.
 */
export function applyVolatilityTick(
  treasury: number,
  deltaNet: number,
  rand: TickRand,
): TickResult {
  let tre = treasury + deltaNet * (1 - PROFIT_SKIM);
  tre *= Math.pow(1 - MANAGEMENT_FEE_DAILY, 1 / 24);

  const raw = Math.exp(
    NOISE_SD_HOURLY * rand.gauss - (NOISE_SD_HOURLY * NOISE_SD_HOURLY) / 2,
  );
  tre *= Math.min(1 + NOISE_CLAMP, Math.max(1 - NOISE_CLAMP, raw));

  let event: TickResult["event"] = null;
  if (rand.roll < CRASH_CHANCE_HOURLY) {
    event = "crash";
    tre *= CRASH_FACTOR_MIN + rand.size * (CRASH_FACTOR_MAX - CRASH_FACTOR_MIN);
  } else if (rand.roll < CRASH_CHANCE_HOURLY + RALLY_CHANCE_HOURLY) {
    event = "rally";
    tre *= RALLY_FACTOR_MIN + rand.size * (RALLY_FACTOR_MAX - RALLY_FACTOR_MIN);
  }

  return { treasury: Math.max(0, tre), event };
}
