/** Casino stock ("BIB-aandeel") tuning. */

/** Price of a share before anyone owns any (and the buy-price floor). */
export const INITIAL_PRICE = 100;

/** A share can never be *bought* below this (prevents free shares underwater). */
export const MIN_PRICE = 1;

/** Max shares per single trade (sanity bound). */
export const MAX_TRADE_QTY = 100_000;

/**
 * Daily management fee ("negative carry"): each day this fraction of the fund's
 * treasury is **burned** (removed from the payout pool), so the price drifts
 * down unless house profit refills it faster. This turns the share from a
 * risk-free hoard into a real bet on casino activity, and is a genuine coin
 * sink. Applied hourly in `snapshot_casino_stock()` as the 1/24 root so it
 * compounds to exactly this rate per day. Mirror in 0062_stock_volatility.sql.
 */
export const MANAGEMENT_FEE_DAILY = 0.02;

/**
 * Volatility knobs — MIRROR of `snapshot_casino_stock()` in
 * `supabase/migrations/0062_stock_volatility.sql` (SQL is authoritative).
 * Together they make the long-run EV of holding ~neutral: only a slice of
 * casino P&L reaches holders (skim), the noise has arithmetic mean exactly 1,
 * and crash/rally sizes×chances cancel out (EV-0 events).
 */
/** Share of casino P&L (both signs) burned at each hourly fold. */
export const PROFIT_SKIM = 0.75;
/** Lognormal sigma per hourly tick (≈ ±1.6%/hour, ≈ ±8%/day). */
export const NOISE_SD_HOURLY = 0.016;
/** A single noise tick is bounded to ±this fraction. */
export const NOISE_CLAMP = 0.07;
/** Chance per hourly tick of a crash. */
export const CRASH_CHANCE_HOURLY = 0.01;
/** Crash multiplies the treasury by a uniform draw from this range (−45…−20%). */
export const CRASH_FACTOR_MIN = 0.55;
export const CRASH_FACTOR_MAX = 0.8;
/** Chance per hourly tick of a rally. */
export const RALLY_CHANCE_HOURLY = 0.02;
/** Rally multiplies the treasury by a uniform draw from this range (+10…+22.5%). */
export const RALLY_FACTOR_MIN = 1.1;
export const RALLY_FACTOR_MAX = 1.225;

/**
 * Anti-whale position limit. A single holder may own at most this fraction of
 * all shares outstanding, but always at least {@link MAX_HOLDING_FLOOR} (so the
 * float can't be cornered, yet early/small players are never blocked).
 */
export const MAX_HOLDING_FRACTION = 0.3;
export const MAX_HOLDING_FLOOR = 1000;

/** Largest position a user may hold given the current shares outstanding. */
export function holdingCap(sharesOutstanding: number): number {
  return Math.max(
    MAX_HOLDING_FLOOR,
    Math.floor(MAX_HOLDING_FRACTION * sharesOutstanding),
  );
}

/**
 * House-banked gambling ledger reasons that move the casino's profit (and so
 * the share price). Player-vs-player games (poker, lottery) are excluded — the
 * house keeps no edge there, so they shouldn't swing the stock.
 *
 * MIRROR of `casino_stats()` (last redefined in the horse-races migration) —
 * keep both lists in sync.
 */
export const CASINO_STAKE_REASONS = [
  "dice_bet",
  "wheel_bet",
  "hilo_bet",
  "keno_bet",
  "plinko_bet",
  "mines_bet",
  "blackjack_bet",
  "roulette_bet",
  "crash_bet",
  "horses_bet",
] as const;

export const CASINO_PAYOUT_REASONS = [
  "dice_payout",
  "wheel_payout",
  "hilo_payout",
  "keno_payout",
  "plinko_payout",
  "mines_payout",
  "blackjack_payout",
  "blackjack_win",
  "roulette_payout",
  "roulette_win",
  "crash_payout",
  "horses_payout",
  "hilo_refund",
  "mines_refund",
  "blackjack_refund",
  "roulette_refund",
  "crash_refund",
] as const;
