import { describe, expect, it } from "vitest";

import {
  addBet,
  initialRouletteTable,
  resolveRound,
  stakeFor,
  startBetting,
} from "@/lib/roulette/table";

describe("multiplayer roulette table", () => {
  it("merges repeated bets on the same spot per user", () => {
    let s = initialRouletteTable();
    s = addBet(s, "a", { type: "red", amount: 50 });
    s = addBet(s, "a", { type: "red", amount: 50 });
    s = addBet(s, "a", { type: "straight", value: 7, amount: 10 });
    s = addBet(s, "b", { type: "red", amount: 30 });

    expect(s.bets).toHaveLength(3); // a:red, a:7, b:red
    expect(s.bets.find((b) => b.userId === "a" && b.type === "red")!.amount).toBe(100);
    expect(stakeFor(s.bets, "a")).toBe(110);
    expect(stakeFor(s.bets, "b")).toBe(30);
  });

  it("resolves each player's bets against the winning number", () => {
    let s = initialRouletteTable();
    s = addBet(s, "a", { type: "red", amount: 100 }); // 7 is red → 200
    s = addBet(s, "a", { type: "straight", value: 7, amount: 10 }); // hit → 360
    s = addBet(s, "b", { type: "black", amount: 100 }); // lose

    s = resolveRound(s, 7);

    expect(s.phase).toBe("result");
    expect(s.winningNumber).toBe(7);
    const a = s.results!.find((r) => r.userId === "a")!;
    const b = s.results!.find((r) => r.userId === "b")!;
    expect(a.staked).toBe(110);
    expect(a.payout).toBe(200 + 360);
    expect(b.staked).toBe(100);
    expect(b.payout).toBe(0);
  });

  it("zero loses every outside bet", () => {
    let s = initialRouletteTable();
    s = addBet(s, "a", { type: "even", amount: 50 });
    s = addBet(s, "a", { type: "straight", value: 0, amount: 5 }); // wins 180
    s = resolveRound(s, 0);
    expect(s.results![0]!.payout).toBe(180);
  });

  it("startBetting clears bets/result and bumps the round number", () => {
    let s = initialRouletteTable();
    s = addBet(s, "a", { type: "red", amount: 50 });
    s = resolveRound(s, 3);
    const fresh = startBetting(s);

    expect(fresh.phase).toBe("betting");
    expect(fresh.roundNo).toBe(s.roundNo + 1);
    expect(fresh.bets).toHaveLength(0);
    expect(fresh.winningNumber).toBeNull();
    expect(fresh.results).toBeNull();
    expect(fresh.bettingEndsAt).toBeNull();
  });
});
