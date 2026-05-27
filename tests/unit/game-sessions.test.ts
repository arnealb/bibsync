import { describe, expect, it } from "vitest";

import { isGamePnL, lastSessionNet, SESSION_GAP_MS } from "@/lib/games/sessions";

const T0 = Date.parse("2026-05-27T20:00:00.000Z");
function at(minutes: number): string {
  return new Date(T0 + minutes * 60_000).toISOString();
}

describe("isGamePnL", () => {
  it("matches casino game reasons", () => {
    expect(isGamePnL("roulette_bet")).toBe(true);
    expect(isGamePnL("blackjack_payout")).toBe(true);
    expect(isGamePnL("poker_cashout")).toBe(true);
    expect(isGamePnL("poker_refund")).toBe(true);
  });

  it("ignores non-gambling reasons", () => {
    expect(isGamePnL("vote")).toBe(false);
    expect(isGamePnL("snake_best")).toBe(false);
    expect(isGamePnL("steps")).toBe(false);
    expect(isGamePnL("achievement")).toBe(false);
  });
});

describe("lastSessionNet", () => {
  it("returns null with no transactions", () => {
    expect(lastSessionNet([])).toBeNull();
  });

  it("sums a single contiguous session", () => {
    const result = lastSessionNet([
      { amount: -50, created_at: at(0) },
      { amount: -50, created_at: at(5) },
      { amount: 175, created_at: at(6) },
    ]);
    expect(result).toEqual({ net: 75, rounds: 3, endedAt: at(6) });
  });

  it("only counts the most recent session after a long gap", () => {
    const result = lastSessionNet([
      { amount: -500, created_at: at(0) }, // old session (a big loss)
      { amount: -200, created_at: at(10) },
      { amount: -50, created_at: at(200) }, // new session, >45min later
      { amount: 120, created_at: at(205) },
    ]);
    expect(result).toEqual({ net: 70, rounds: 2, endedAt: at(205) });
  });

  it("treats a gap exactly at the threshold as the same session", () => {
    const gapMin = SESSION_GAP_MS / 60_000;
    const result = lastSessionNet([
      { amount: -10, created_at: at(0) },
      { amount: 30, created_at: at(gapMin) },
    ]);
    expect(result?.rounds).toBe(2);
    expect(result?.net).toBe(20);
  });

  it("ignores order of the input (sorts internally)", () => {
    const result = lastSessionNet([
      { amount: 175, created_at: at(6) },
      { amount: -50, created_at: at(0) },
      { amount: -50, created_at: at(5) },
    ]);
    expect(result).toEqual({ net: 75, rounds: 3, endedAt: at(6) });
  });
});
