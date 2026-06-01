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
 * compounds to exactly this rate per day. Mirror in 0055_stock_fee.sql.
 */
export const MANAGEMENT_FEE_DAILY = 0.01;

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
 * MIRROR of `casino_stats()` in `supabase/migrations/0050_casino_stock.sql` —
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
  "hilo_refund",
  "mines_refund",
  "blackjack_refund",
  "roulette_refund",
  "crash_refund",
] as const;
