import { describe, expect, it } from "vitest";

import {
  WHEEL_ORDER,
  colorOf,
  payoutFor,
  pickNumber,
  totalPayout,
  type Bet,
} from "@/lib/roulette/engine";

describe("wheel + colors", () => {
  it("has all 37 numbers exactly once", () => {
    expect(new Set(WHEEL_ORDER).size).toBe(37);
    expect(Math.min(...WHEEL_ORDER)).toBe(0);
    expect(Math.max(...WHEEL_ORDER)).toBe(36);
  });
  it("colours numbers correctly", () => {
    expect(colorOf(0)).toBe("green");
    expect(colorOf(1)).toBe("red");
    expect(colorOf(2)).toBe("black");
    expect(colorOf(17)).toBe("black");
    expect(colorOf(36)).toBe("red");
  });
});

describe("payoutFor", () => {
  it("pays 35:1 on a straight hit, nothing on a miss", () => {
    expect(payoutFor({ type: "straight", value: 17, amount: 10 }, 17)).toBe(360);
    expect(payoutFor({ type: "straight", value: 17, amount: 10 }, 18)).toBe(0);
  });
  it("pays even money on red/even/low", () => {
    expect(payoutFor({ type: "red", amount: 10 }, 1)).toBe(20);
    expect(payoutFor({ type: "even", amount: 10 }, 4)).toBe(20);
    expect(payoutFor({ type: "low", amount: 10 }, 18)).toBe(20);
    expect(payoutFor({ type: "red", amount: 10 }, 2)).toBe(0); // 2 is black
  });
  it("pays 2:1 on dozens and columns", () => {
    expect(payoutFor({ type: "dozen2", amount: 10 }, 13)).toBe(30);
    expect(payoutFor({ type: "col1", amount: 10 }, 34)).toBe(30); // 34 % 3 == 1
    expect(payoutFor({ type: "col3", amount: 10 }, 36)).toBe(30);
  });
  it("zero loses every outside bet", () => {
    for (const type of ["red", "even", "low", "dozen1", "col1"] as const) {
      expect(payoutFor({ type, amount: 10 }, 0)).toBe(0);
    }
    expect(payoutFor({ type: "straight", value: 0, amount: 10 }, 0)).toBe(360);
  });
});

describe("totalPayout + pickNumber", () => {
  it("sums winning bets", () => {
    const bets: Bet[] = [
      { type: "straight", value: 7, amount: 5 },
      { type: "red", amount: 10 },
      { type: "even", amount: 10 },
    ];
    // 7 is red & odd -> straight 180 + red 20 + even 0 = 200
    expect(totalPayout(bets, 7)).toBe(200);
  });
  it("stays within 0–36", () => {
    expect(pickNumber(() => 0)).toBe(0);
    expect(pickNumber(() => 0.999999)).toBe(36);
  });
});
