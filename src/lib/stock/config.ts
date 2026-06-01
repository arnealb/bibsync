/** Casino stock ("BIB-aandeel") tuning. */

/** Price of a share before anyone owns any (and the buy-price floor). */
export const INITIAL_PRICE = 100;

/** A share can never be *bought* below this (prevents free shares underwater). */
export const MIN_PRICE = 1;

/** Max shares per single trade (sanity bound). */
export const MAX_TRADE_QTY = 100_000;

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
