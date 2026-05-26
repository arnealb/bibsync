import { describe, expect, it } from "vitest";

import {
  canSplit,
  deal,
  doubleDown,
  handTotal,
  hit,
  isBlackjack,
  split,
  stand,
  toPublicBlackjack,
  totalPayout,
} from "@/lib/blackjack/engine";
import type { Card } from "@/lib/poker/cards";

const c = (s: string) => s.split(" ") as Card[];

describe("handTotal", () => {
  it("counts an ace as 11 when it fits (soft)", () => {
    expect(handTotal(c("Ah Kd"))).toEqual({ total: 21, soft: true });
  });
  it("reduces aces to 1 to avoid busting", () => {
    expect(handTotal(c("Ah 9d 9c"))).toEqual({ total: 19, soft: false });
  });
  it("flags blackjack", () => {
    expect(isBlackjack(c("As Kd"))).toBe(true);
    expect(isBlackjack(c("As 5d 5c"))).toBe(false);
  });
});

describe("deal", () => {
  it("pays 3:2 on a natural blackjack", () => {
    const s = deal("r1", c("As Kd 9h 7c 5d 5s"), 100);
    expect(s.status).toBe("done");
    expect(s.hands[0].result).toBe("blackjack");
    expect(totalPayout(s)).toBe(250);
  });

  it("pushes when both have blackjack", () => {
    const s = deal("r1", c("As Kd Ah Qc 5d"), 100);
    expect(s.hands[0].result).toBe("push");
    expect(totalPayout(s)).toBe(100);
  });

  it("otherwise hands control to the player", () => {
    const s = deal("r1", c("Td 9c 8h 7s 2d"), 100);
    expect(s.status).toBe("player");
    expect(s.hands[0].result).toBeNull();
  });
});

describe("player actions", () => {
  it("busts on a hit over 21", () => {
    let s = deal("r1", c("Td 6c 9h 9s Kh"), 100);
    s = hit(s); // draws Kh -> 26
    expect(s.status).toBe("done");
    expect(s.hands[0].result).toBe("lose");
    expect(totalPayout(s)).toBe(0);
  });

  it("wins when the dealer busts after standing", () => {
    let s = deal("r1", c("Td 9c Tc 6h Kd"), 100);
    s = stand(s);
    expect(s.hands[0].result).toBe("win");
    expect(totalPayout(s)).toBe(200);
  });

  it("doubles the bet, draws one, then resolves", () => {
    let s = deal("r1", c("5d 6c Tc 7h 9h"), 100);
    s = doubleDown(s);
    expect(s.hands[0].bet).toBe(200);
    expect(s.hands[0].result).toBe("win");
    expect(totalPayout(s)).toBe(400);
  });
});

describe("split", () => {
  it("splits a pair into two hands and resolves both", () => {
    // pair of 8s; each draws a K (18); dealer 13 -> draws K -> 23 bust
    let s = deal("r1", c("8d 8c 6h 7s Kd Kc Kh"), 100);
    expect(canSplit(s)).toBe(true);
    s = split(s);
    expect(s.hands.length).toBe(2);
    s = stand(s); // hand 0
    s = stand(s); // hand 1 -> dealer plays
    expect(s.status).toBe("done");
    expect(s.hands.every((h) => h.result === "win")).toBe(true);
    expect(totalPayout(s)).toBe(400);
  });

  it("split aces draw one card each and auto-resolve", () => {
    // aces split -> 20 each; dealer 17 stands -> both win
    const s = split(deal("r1", c("Ad Ac 9h 8s 9d 9c"), 100));
    expect(s.status).toBe("done");
    expect(totalPayout(s)).toBe(400);
  });
});

describe("toPublicBlackjack", () => {
  it("hides the dealer hole card while the player acts", () => {
    const pub = toPublicBlackjack(deal("r1", c("Td 9c 8h 7s 2d"), 100));
    expect(pub.dealer).toEqual(["8h"]);
    expect(pub.dealerTotal).toBeNull();
    expect(pub.canDouble).toBe(true);
  });
});
