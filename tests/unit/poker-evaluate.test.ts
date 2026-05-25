import { describe, expect, it } from "vitest";

import type { Card } from "@/lib/poker/cards";
import {
  HAND_CATEGORY,
  compareHands,
  evaluate5,
  evaluate7,
  handLabel,
} from "@/lib/poker/evaluate";

const c = (s: string) => s.split(" ") as Card[];

describe("evaluate5 categories", () => {
  it("detects a royal flush", () => {
    const v = evaluate5(c("As Ks Qs Js Ts"));
    expect(v.category).toBe(HAND_CATEGORY.STRAIGHT_FLUSH);
    expect(v.tiebreak[0]).toBe(14);
    expect(handLabel(v)).toBe("Royal flush");
  });

  it("detects the wheel straight (A-2-3-4-5, high card 5)", () => {
    const v = evaluate5(c("Ah 2d 3c 4s 5h"));
    expect(v.category).toBe(HAND_CATEGORY.STRAIGHT);
    expect(v.tiebreak[0]).toBe(5);
  });

  it("detects four of a kind with kicker", () => {
    const v = evaluate5(c("9s 9h 9d 9c Kd"));
    expect(v.category).toBe(HAND_CATEGORY.QUADS);
    expect(v.tiebreak).toEqual([9, 13]);
  });

  it("detects a full house", () => {
    const v = evaluate5(c("3s 3h 3d 6c 6d"));
    expect(v.category).toBe(HAND_CATEGORY.FULL_HOUSE);
    expect(v.tiebreak).toEqual([3, 6]);
  });

  it("detects two pair with kicker", () => {
    const v = evaluate5(c("As Ad 7c 7d 2h"));
    expect(v.category).toBe(HAND_CATEGORY.TWO_PAIR);
    expect(v.tiebreak).toEqual([14, 7, 2]);
  });
});

describe("compareHands", () => {
  it("ranks categories correctly", () => {
    const flush = evaluate5(c("As Ks 9s 5s 2s"));
    const straight = evaluate5(c("Ah Kd Qc Js Th"));
    expect(compareHands(flush, straight)).toBeGreaterThan(0);
  });

  it("breaks ties on kickers", () => {
    const aceKing = evaluate5(c("As Ah Kd 7c 2s"));
    const aceQueen = evaluate5(c("Ad Ac Qh 7d 2c"));
    expect(compareHands(aceKing, aceQueen)).toBeGreaterThan(0);
  });

  it("treats identical hands as equal", () => {
    const a = evaluate5(c("As Ah Kd 7c 2s"));
    const b = evaluate5(c("Ac Ad Kh 7s 2d"));
    expect(compareHands(a, b)).toBe(0);
  });
});

describe("evaluate7 picks the best five", () => {
  it("finds a flush hidden in seven cards", () => {
    const v = evaluate7(c("As 9s 4s 2s Kd 7h Js"));
    expect(v.category).toBe(HAND_CATEGORY.FLUSH);
    // Best five spades: A,J,9,4,2
    expect(v.tiebreak).toEqual([14, 11, 9, 4, 2]);
  });

  it("finds a straight across hole and board", () => {
    const v = evaluate7(c("5h 6d 7c 8s 9h Kd 2c"));
    expect(v.category).toBe(HAND_CATEGORY.STRAIGHT);
    expect(v.tiebreak[0]).toBe(9);
  });
});
