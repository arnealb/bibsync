import { describe, expect, it } from "vitest";

import { INITIAL_PRICE, MIN_PRICE, PROFIT_SKIM } from "@/lib/stock/config";
import {
  applyBuy,
  applySell,
  liveTreasury,
  sellPrice,
  sharePrice,
  type StockState,
} from "@/lib/stock/engine";

const EMPTY: StockState = { shares: 0, treasury: 0, baselineNet: 0 };

describe("sharePrice", () => {
  it("is the initial price when nobody owns shares", () => {
    expect(sharePrice(EMPTY, 0)).toBe(INITIAL_PRICE);
    expect(sharePrice(EMPTY, 999_999)).toBe(INITIAL_PRICE);
  });

  it("equals treasury per share once held", () => {
    const state: StockState = { shares: 10, treasury: 1500, baselineNet: 0 };
    expect(sharePrice(state, 0)).toBe(150);
  });

  it("never drops below the floor for buying", () => {
    const state: StockState = { shares: 10, treasury: 1, baselineNet: 0 };
    expect(sharePrice(state, 0)).toBe(MIN_PRICE);
  });
});

describe("house profit moves the price", () => {
  it("rises when the casino wins (net up)", () => {
    const state: StockState = { shares: 10, treasury: 1000, baselineNet: 0 };
    expect(sharePrice(state, 0)).toBe(100);
    // Casino nets +500, skimmed to +125 → +12.5 per share.
    expect(sharePrice(state, 500)).toBe(112.5);
  });

  it("falls when players win (net down)", () => {
    const state: StockState = { shares: 10, treasury: 1000, baselineNet: 1000 };
    // Net dropped from 1000 → 600: −400, damped to −100 by the skim.
    expect(sharePrice(state, 600)).toBe(90);
  });

  it("sell price hits 0 when the fund is underwater", () => {
    const state: StockState = { shares: 10, treasury: 1000, baselineNet: 5000 };
    expect(sellPrice(state, 0)).toBe(0); // lost more than it held
  });
});

describe("buying is price-neutral", () => {
  it("first buy seeds the treasury at the initial price", () => {
    const { state, cost, price } = applyBuy(EMPTY, 0, 5);
    expect(price).toBe(INITIAL_PRICE);
    expect(cost).toBe(INITIAL_PRICE * 5);
    expect(state.shares).toBe(5);
    expect(state.treasury).toBe(INITIAL_PRICE * 5);
  });

  it("does not move the price (NAV per share unchanged)", () => {
    const start: StockState = { shares: 20, treasury: 4000, baselineNet: 0 };
    const before = sharePrice(start, 0);
    const { state } = applyBuy(start, 0, 7);
    // Within a coin of rounding.
    expect(Math.abs(sharePrice(state, 0) - before)).toBeLessThanOrEqual(1);
  });
});

describe("trading cannot mint free coins", () => {
  it("a churn round-trip (no house movement) never profits", () => {
    for (let net = 0; net <= 5000; net += 137) {
      for (let qty = 1; qty <= 50; qty += 7) {
        const start: StockState = { shares: 30, treasury: 9000, baselineNet: net };
        const bought = applyBuy(start, net, qty);
        const sold = applySell(bought.state, net, qty);
        // Buy cost rounds up, sell proceeds round down → can't come out ahead.
        expect(sold.proceeds).toBeLessThanOrEqual(bought.cost);
      }
    }
  });

  it("sell proceeds never exceed the live treasury", () => {
    const state: StockState = { shares: 40, treasury: 8000, baselineNet: 200 };
    const sold = applySell(state, 1000, 40); // sell everything after a win
    expect(sold.proceeds).toBeLessThanOrEqual(
      Math.floor(liveTreasury(state, 1000)),
    );
    expect(sold.state.shares).toBe(0);
    expect(sold.state.treasury).toBe(0); // fully settled
  });

  it("a trade-time fold skims the accrued delta too (no skim bypass)", () => {
    const state: StockState = { shares: 10, treasury: 1000, baselineNet: 0 };
    const { state: next, cost } = applyBuy(state, 400, 1);
    // +400 accrued P&L folds in at (1 − PROFIT_SKIM) = 25% → 1100, plus cost.
    expect(next.treasury).toBe(1000 + 400 * (1 - PROFIT_SKIM) + cost);
    expect(next.baselineNet).toBe(400);
  });
});
