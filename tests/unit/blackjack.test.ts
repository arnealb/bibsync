import { describe, expect, it } from "vitest";

import {
  deal,
  doubleDown,
  handTotal,
  hit,
  isBlackjack,
  stand,
  toPublicBlackjack,
} from "@/lib/blackjack/engine";
import type { Card } from "@/lib/poker/cards";

const c = (s: string) => s.split(" ") as Card[];

describe("handTotal", () => {
  it("counts an ace as 11 when it fits (soft)", () => {
    expect(handTotal(c("Ah Kd"))).toEqual({ total: 21, soft: true });
  });
  it("reduces aces to 1 to avoid busting", () => {
    expect(handTotal(c("Ah 9d 9c"))).toEqual({ total: 19, soft: false });
    expect(handTotal(c("Ah Ad 9c"))).toEqual({ total: 21, soft: true });
  });
  it("flags blackjack", () => {
    expect(isBlackjack(c("As Kd"))).toBe(true);
    expect(isBlackjack(c("As 5d 5c"))).toBe(false);
  });
});

describe("deal", () => {
  it("pays 3:2 on a natural blackjack", () => {
    // player = As,Kd (21); dealer = 9h,7c (16)
    const s = deal("r1", c("As Kd 9h 7c 5d 5s"), 100);
    expect(s.status).toBe("done");
    expect(s.result).toBe("blackjack");
    expect(s.payout).toBe(250); // floor(100 * 2.5)
  });

  it("pushes when both have blackjack", () => {
    const s = deal("r1", c("As Kd Ah Qc 5d"), 100);
    expect(s.result).toBe("push");
    expect(s.payout).toBe(100);
  });

  it("otherwise hands control to the player", () => {
    const s = deal("r1", c("Td 9c 8h 7s 2d"), 100);
    expect(s.status).toBe("player");
    expect(s.result).toBeNull();
  });
});

describe("player actions", () => {
  it("busts on a hit over 21", () => {
    let s = deal("r1", c("Td 6c 9h 9s Kh"), 100);
    s = hit(s); // draws Kh -> 26
    expect(s.status).toBe("done");
    expect(s.result).toBe("lose");
    expect(s.payout).toBe(0);
  });

  it("wins when the dealer busts after standing", () => {
    // player Td,9c (19); dealer Tc,6h (16) -> draws Kd -> 26 bust
    let s = deal("r1", c("Td 9c Tc 6h Kd"), 100);
    s = stand(s);
    expect(s.result).toBe("win");
    expect(s.payout).toBe(200);
  });

  it("doubles the bet, draws one, then resolves", () => {
    // player 5d,6c (11) -> double draws 9h -> 20; dealer Tc,7h (17) stands
    let s = deal("r1", c("5d 6c Tc 7h 9h"), 100);
    s = doubleDown(s);
    expect(s.bet).toBe(200);
    expect(s.result).toBe("win");
    expect(s.payout).toBe(400);
  });
});

describe("toPublicBlackjack", () => {
  it("hides the dealer hole card while the player acts", () => {
    const s = deal("r1", c("Td 9c 8h 7s 2d"), 100);
    const pub = toPublicBlackjack(s);
    expect(pub.dealer).toEqual(["8h"]); // only the up-card
    expect(pub.dealerTotal).toBeNull();
    expect(pub.canDouble).toBe(true);
  });
});
