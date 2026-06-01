/** A full snapshot of the casino stock for one viewer. */
export interface StockQuote {
  /** Current price per share (NAV, floored at MIN_PRICE for buying). */
  price: number;
  /** Shares outstanding across all holders. */
  sharesOutstanding: number;
  /** The viewer's own shares. */
  myShares: number;
  /** What the viewer's shares are worth right now (sell value). */
  myValue: number;
  /** Total coins the viewer put in (net of sales). */
  myCostBasis: number;
  /** myValue − myCostBasis. */
  myPnl: number;
  /** The viewer's wallet balance. */
  balance: number;
  /** Casino house profit so far (drives the price). */
  houseProfit: number;
  /** Total bibcoins ever wagered in house-banked games. */
  wagered: number;
}

/** One point on the price chart. */
export interface StockTick {
  price: number;
  recordedAt: string;
}

export type StockTradeResult =
  | { ok: true; quote: StockQuote }
  | { ok: false; error: string };
