import { INITIAL_PRICE, MIN_PRICE, PROFIT_SKIM } from "@/lib/stock/config";

/**
 * Casino stock pricing — a net-asset-value (NAV) fund backed by the casino's
 * realized house profit.
 *
 * The treasury holds: the coins shareholders invested **plus** the casino's
 * house profit accrued while shares were outstanding. Price = treasury / shares.
 *
 * Why this is fair and not a money printer:
 * - Buying/selling at the current price is *price-neutral* (NAV per share is
 *   unchanged), so trading alone can't move the price.
 * - The price only moves because the casino wins (players lose → treasury up)
 *   or loses (players win big → treasury down). That's the whole point.
 * - Since 0062 only a (1 − PROFIT_SKIM) slice of that casino P&L reaches the
 *   treasury (the rest is burned), applied at every fold so it can't be
 *   traded around; on top, the hourly tick adds a fee, noise and crash/rally
 *   events (see lib/stock/tick.ts + migration 0062).
 * - Total payouts are bounded by the treasury, which is bounded by real house
 *   profit — you can never withdraw more than the casino actually earned.
 *
 * `treasury` is folded forward to `baselineNet`: it already includes house
 * profit up to that casino-net snapshot. {@link liveTreasury} adds the profit
 * earned since.
 */
export interface StockState {
  /** Shares outstanding (whole shares). */
  shares: number;
  /** Bibcoins backing the fund, folded forward to {@link StockState.baselineNet}. */
  treasury: number;
  /** Casino net profit captured at the last fold. */
  baselineNet: number;
}

/**
 * Treasury including house profit earned since the last fold, after the
 * profit skim: only (1 − PROFIT_SKIM) of casino P&L (both signs) ever reaches
 * the fund. The skim lives HERE — the single fold point used by trades, the
 * hourly tick mirror and seizures — so trading right before the hourly tick
 * cannot capture the un-skimmed delta or disable the skim for other holders.
 */
export function liveTreasury(state: StockState, casinoNet: number): number {
  // No shareholders → house profit has no owner, so it isn't captured.
  if (state.shares <= 0) return 0;
  return state.treasury + (casinoNet - state.baselineNet) * (1 - PROFIT_SKIM);
}

/** Headline / buy price per share — floored so buying always costs something. */
export function sharePrice(state: StockState, casinoNet: number): number {
  if (state.shares <= 0) return INITIAL_PRICE;
  return Math.max(MIN_PRICE, liveTreasury(state, casinoNet) / state.shares);
}

/** Fair sell price (true NAV) — can hit 0 if the fund is underwater. */
export function sellPrice(state: StockState, casinoNet: number): number {
  if (state.shares <= 0) return 0;
  return Math.max(0, liveTreasury(state, casinoNet) / state.shares);
}

export interface BuyResult {
  state: StockState;
  price: number;
  cost: number;
}

/** Buy `qty` shares at the current price. Cost rounds up (favours the fund). */
export function applyBuy(
  state: StockState,
  casinoNet: number,
  qty: number,
): BuyResult {
  const price = sharePrice(state, casinoNet);
  const cost = Math.ceil(price * qty);
  const folded = liveTreasury(state, casinoNet); // 0 when shares == 0
  return {
    price,
    cost,
    state: {
      shares: state.shares + qty,
      treasury: folded + cost,
      baselineNet: casinoNet,
    },
  };
}

export interface SellResult {
  state: StockState;
  price: number;
  proceeds: number;
}

/** Sell `qty` shares at the current price. Proceeds round down (favours fund). */
export function applySell(
  state: StockState,
  casinoNet: number,
  qty: number,
): SellResult {
  const price = sellPrice(state, casinoNet);
  const proceeds = Math.floor(price * qty);
  const folded = liveTreasury(state, casinoNet);
  const newShares = state.shares - qty;
  return {
    price,
    proceeds,
    state: {
      shares: newShares,
      // Settle to exactly empty when the last share leaves.
      treasury: newShares <= 0 ? 0 : folded - proceeds,
      baselineNet: casinoNet,
    },
  };
}
