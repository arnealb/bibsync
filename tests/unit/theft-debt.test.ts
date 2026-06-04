import { describe, expect, it } from "vitest";

import { garnishSplit, isGarnishExempt } from "@/lib/theft/debt";

describe("garnishSplit", () => {
  it("takes half of a credit while in debt", () => {
    expect(garnishSplit(100, 1000)).toEqual({ kept: 50, garnished: 50 });
  });

  it("rounds the garnish down (the user keeps the odd coin)", () => {
    expect(garnishSplit(5, 1000)).toEqual({ kept: 3, garnished: 2 });
    expect(garnishSplit(1, 1000)).toEqual({ kept: 1, garnished: 0 });
  });

  it("never takes more than the remaining debt", () => {
    expect(garnishSplit(100, 30)).toEqual({ kept: 70, garnished: 30 });
  });

  it("is a no-op without debt", () => {
    expect(garnishSplit(100, 0)).toEqual({ kept: 100, garnished: 0 });
  });

  it("is a no-op for a non-positive amount", () => {
    expect(garnishSplit(0, 500)).toEqual({ kept: 0, garnished: 0 });
  });
});

describe("isGarnishExempt", () => {
  it("exempts refund-style reasons", () => {
    expect(isGarnishExempt("stock_refund")).toBe(true);
    expect(isGarnishExempt("name-change-refund")).toBe(true);
    expect(isGarnishExempt("theft_loss_refund")).toBe(true);
    expect(isGarnishExempt("crate_dup")).toBe(true);
    expect(isGarnishExempt("theft_seizure")).toBe(true);
  });

  it("garnishes ordinary income", () => {
    expect(isGarnishExempt("hourly")).toBe(false);
    expect(isGarnishExempt("stock_sell")).toBe(false);
    expect(isGarnishExempt("theft_gain")).toBe(false);
    expect(isGarnishExempt("blackjack_payout")).toBe(false);
  });
});
