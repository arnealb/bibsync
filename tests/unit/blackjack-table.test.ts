import { describe, expect, it } from "vitest";

import type { Card } from "@/lib/poker/cards";
import {
  addSeat,
  applyAction,
  deal,
  initialTable,
  legalSeatActions,
  placeBet,
  startBetting,
  type TableState,
} from "@/lib/blackjack/table";

function seated(bets: [string, number][]): TableState {
  let s = initialTable();
  for (const [userId, bet] of bets) s = placeBet(s, userId, bet);
  return s;
}

describe("multiplayer blackjack — dealing & turn order", () => {
  it("deals two cards to each better and to the dealer, in seat order", () => {
    const deck = ["Tc", "9c", "8c", "7c", "Ts", "6s", "5h"] as Card[];
    const s = deal(seated([["a", 100], ["b", 100]]), deck);

    expect(s.phase).toBe("player");
    expect(s.seats[0]!.hands[0]!.cards).toEqual(["Tc", "9c"]);
    expect(s.seats[1]!.hands[0]!.cards).toEqual(["8c", "7c"]);
    expect(s.dealer).toEqual(["Ts", "6s"]); // masked by toPublicTable, full here
    expect(s.toActIndex).toBe(0);
  });

  it("advances turn seat-by-seat, then dealer plays to 17+ and settles", () => {
    const deck = ["Tc", "9c", "8c", "7c", "Ts", "6s", "5h"] as Card[];
    let s = deal(seated([["a", 100], ["b", 100]]), deck);

    s = applyAction(s, "a", "stand");
    expect(s.toActIndex).toBe(1); // a done → b's turn

    s = applyAction(s, "b", "stand");
    expect(s.phase).toBe("done");
    expect(s.dealer).toEqual(["Ts", "6s", "5h"]); // 16 → hit 5 → 21
    expect(s.seats[0]!.hands[0]!.result).toBe("lose"); // 19 < 21
    expect(s.seats[1]!.hands[0]!.result).toBe("lose"); // 15 < 21
  });

  it("rejects acting out of turn", () => {
    const deck = ["Tc", "9c", "8c", "7c", "Ts", "6s", "5h"] as Card[];
    const s = deal(seated([["a", 100], ["b", 100]]), deck);
    expect(() => applyAction(s, "b", "hit")).toThrow();
  });
});

describe("multiplayer blackjack — naturals", () => {
  it("pays a natural blackjack 3:2 and skips that seat's turn", () => {
    const deck = ["As", "Ks", "5c", "6c", "9s", "7s", "4h"] as Card[];
    let s = deal(seated([["a", 100], ["b", 100]]), deck);

    expect(s.seats[0]!.done).toBe(true); // a has blackjack
    expect(s.toActIndex).toBe(1); // turn skips to b

    s = applyAction(s, "b", "stand");
    expect(s.phase).toBe("done");
    expect(s.seats[0]!.hands[0]!.result).toBe("blackjack");
    expect(s.seats[0]!.hands[0]!.payout).toBe(250); // floor(100 * 2.5)
  });

  it("dealer blackjack no longer ends the round early — players still draw, and a hit-to-21 pushes", () => {
    const deck = ["7c", "4c", "Ad", "Kd", "Td"] as Card[];
    let s = deal(seated([["a", 100]]), deck);

    // Dealer has a natural (Ad,Kd) but the round keeps going so a can play.
    expect(s.phase).toBe("player");
    expect(s.toActIndex).toBe(0);

    s = applyAction(s, "a", "hit"); // 11 → 21 (three cards, not a natural)
    expect(s.seats[0]!.hands[0]!.cards).toEqual(["7c", "4c", "Td"]);

    s = applyAction(s, "a", "stand");
    expect(s.phase).toBe("done");
    expect(s.seats[0]!.hands[0]!.result).toBe("push"); // 21 vs dealer 21
    expect(s.seats[0]!.hands[0]!.payout).toBe(100);
  });

  it("dealer blackjack: a stiff hand still loses, a natural still pushes", () => {
    const deck = ["Tc", "8c", "Ad", "Kd", "As", "Ks"] as Card[];
    let s = deal(seated([["a", 100], ["b", 100]]), deck);

    expect(s.phase).toBe("player"); // a must still act
    expect(s.seats[1]!.done).toBe(true); // b's natural auto-stands

    s = applyAction(s, "a", "stand");
    expect(s.phase).toBe("done");
    expect(s.seats[0]!.hands[0]!.result).toBe("lose"); // 18 vs dealer 21
    expect(s.seats[1]!.hands[0]!.result).toBe("push"); // natural vs dealer BJ
    expect(s.seats[1]!.hands[0]!.payout).toBe(100);
  });
});

describe("multiplayer blackjack — double & split", () => {
  it("double doubles the bet, draws exactly one, and finishes the hand", () => {
    const deck = ["5c", "6c", "Ts", "7s", "9h"] as Card[];
    let s = deal(seated([["a", 100]]), deck);

    expect(legalSeatActions(s, "a").canDouble).toBe(true);
    s = applyAction(s, "a", "double");

    const hand = s.seats[0]!.hands[0]!;
    expect(hand.bet).toBe(200);
    expect(hand.cards).toEqual(["5c", "6c", "9h"]); // 20
    expect(s.phase).toBe("done");
    expect(hand.result).toBe("win"); // 20 > dealer 17
    expect(hand.payout).toBe(400);
  });

  it("split turns a pair into two hands, each drawing one card", () => {
    const deck = ["8c", "8d", "Tc", "9c", "3h", "2h", "4d", "5d"] as Card[];
    let s = deal(seated([["a", 100]]), deck);

    expect(legalSeatActions(s, "a").canSplit).toBe(true);
    s = applyAction(s, "a", "split");

    expect(s.seats[0]!.hands).toHaveLength(2);
    expect(s.seats[0]!.hands[0]!.cards).toEqual(["8c", "3h"]);
    expect(s.seats[0]!.hands[1]!.cards).toEqual(["8d", "2h"]);
    expect(s.seats[0]!.activeHand).toBe(0);
    expect(s.seats[0]!.done).toBe(false);
  });
});

describe("multiplayer blackjack — seats & rounds", () => {
  it("a seated player who didn't bet sits the round out", () => {
    let s = seated([["a", 100]]);
    s = addSeat(s, "b"); // b joins but doesn't bet
    s = deal(s, ["Tc", "9c", "Ts", "7s", "2h"] as Card[]);

    expect(s.seats[1]!.hands).toHaveLength(0);
    expect(s.seats[1]!.done).toBe(true);
    expect(s.toActIndex).toBe(0); // only a acts
  });

  it("startBetting clears hands but keeps seats", () => {
    const deck = ["Tc", "9c", "8c", "7c", "Ts", "6s", "5h"] as Card[];
    let s = deal(seated([["a", 100], ["b", 100]]), deck);
    s = applyAction(s, "a", "stand");
    s = applyAction(s, "b", "stand");

    const fresh = startBetting(s);
    expect(fresh.phase).toBe("betting");
    expect(fresh.roundNo).toBe(s.roundNo + 1);
    expect(fresh.seats).toHaveLength(2);
    expect(fresh.seats.every((seat) => seat.hands.length === 0)).toBe(true);
    expect(fresh.dealer).toHaveLength(0);
  });
});
