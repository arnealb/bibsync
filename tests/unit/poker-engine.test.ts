import { describe, expect, it } from "vitest";

import type { Card } from "@/lib/poker/cards";
import {
  addPlayer,
  applyAction,
  buildSidePots,
  initialState,
  potTotal,
  requestLeave,
  startHand,
  type ActionType,
  type EnginePlayer,
  type FullState,
} from "@/lib/poker/engine";

const deck = (s: string) => s.split(" ") as Card[];

function chipsOf(state: FullState, userId: string): number {
  return state.players.find((p) => p.userId === userId)!.chips;
}

/** Apply an action as whoever is currently to act. */
function act(state: FullState, action: ActionType, amount?: number): FullState {
  const userId = state.players[state.toActIndex!].userId;
  return applyAction(state, userId, action, amount);
}

function table(players: [string, number][]): FullState {
  let s = initialState(10, 20);
  for (const [id, chips] of players) s = addPlayer(s, id, chips);
  return s;
}

describe("startHand (heads-up)", () => {
  it("posts blinds, deals, and puts the button/SB first to act", () => {
    const s = startHand(
      table([
        ["A", 2000],
        ["B", 2000],
      ]),
      deck("As Ah Kd Kc 2c 7d 9s Js 3h"),
    );
    expect(s.handNo).toBe(1);
    expect(s.status).toBe("betting");
    expect(s.street).toBe("preflop");
    expect(s.buttonIndex).toBe(0);
    expect(s.players[s.toActIndex!].userId).toBe("A"); // SB acts first heads-up
    expect(s.currentBet).toBe(20);
    expect(chipsOf(s, "A")).toBe(1990); // small blind
    expect(chipsOf(s, "B")).toBe(1980); // big blind
    expect(s.hole["A"]).toEqual(["As", "Ah"]);
    expect(s.hole["B"]).toEqual(["Kd", "Kc"]);
  });
});

describe("fold ends the hand immediately", () => {
  it("awards the pot to the last player standing", () => {
    let s = startHand(
      table([
        ["A", 2000],
        ["B", 2000],
      ]),
      deck("As Ah Kd Kc 2c 7d 9s Js 3h"),
    );
    s = act(s, "fold"); // A (SB) folds
    expect(s.status).toBe("showdown");
    expect(chipsOf(s, "B")).toBe(2010);
    expect(chipsOf(s, "A")).toBe(1990);
    expect(s.result?.payouts).toEqual([{ userId: "B", amount: 30 }]);
    expect(s.result?.revealed).toEqual([]); // no showdown on a fold
  });
});

describe("a full check-down to showdown", () => {
  it("awards the pot to the best hand", () => {
    let s = startHand(
      table([
        ["A", 2000],
        ["B", 2000],
      ]),
      deck("As Ah Kd Kc 2c 7d 9s Js 3h"),
    );
    s = act(s, "call"); // A completes the small blind
    s = act(s, "check"); // B checks option -> flop
    s = act(s, "check"); // flop
    s = act(s, "check");
    s = act(s, "check"); // turn
    s = act(s, "check");
    s = act(s, "check"); // river
    s = act(s, "check"); // -> showdown

    expect(s.status).toBe("showdown");
    expect(s.community).toEqual(["2c", "7d", "9s", "Js", "3h"]);
    expect(chipsOf(s, "A")).toBe(2020); // pair of aces beats pair of kings
    expect(chipsOf(s, "B")).toBe(1980);
    expect(s.result?.potTotal).toBe(40);
    expect(s.result?.revealed.map((r) => r.userId).sort()).toEqual(["A", "B"]);
  });
});

describe("side pots with unequal all-ins", () => {
  it("splits a main pot and a side pot to different winners", () => {
    // A:100, B:50, C:2000. Button=A, SB=B, BB=C.
    let s = startHand(
      table([
        ["A", 100],
        ["B", 50],
        ["C", 2000],
      ]),
      deck("2c 3d Ah Ad Kh Kd As Ks 7h 8c 9d"),
    );
    expect(s.players[s.toActIndex!].userId).toBe("A"); // UTG acts first
    s = act(s, "allin"); // A all-in 100
    s = act(s, "allin"); // B all-in 50 (call for less)
    s = act(s, "call"); // C calls 100 -> run-out + showdown

    expect(s.status).toBe("showdown");
    // B has trip aces -> wins the 150 main pot; C has trip kings -> 100 side pot.
    expect(chipsOf(s, "B")).toBe(150);
    expect(chipsOf(s, "C")).toBe(2000);
    expect(chipsOf(s, "A")).toBe(0);
    expect(potTotal(s)).toBe(250);
  });
});

describe("requestLeave", () => {
  it("removes the seat immediately between hands", () => {
    const s = requestLeave(
      table([
        ["A", 2000],
        ["B", 2000],
        ["C", 2000],
      ]),
      "B",
    );
    expect(s.players.map((p) => p.userId)).toEqual(["A", "C"]);
  });

  it("folds a leaver mid-hand and removes them on the next deal", () => {
    let s = startHand(
      table([
        ["A", 2000],
        ["B", 2000],
      ]),
      deck("As Ah Kd Kc 2c 7d 9s Js 3h"),
    );
    s = requestLeave(s, "A"); // A is to act -> folds and is flagged leaving
    expect(s.status).toBe("showdown");
    expect(chipsOf(s, "B")).toBe(2010);
    expect(s.players.find((p) => p.userId === "A")?.leaving).toBe(true);
    expect(s.players.some((p) => p.userId === "A")).toBe(true); // still seated

    // C joins, next deal drops the leaver A.
    s = addPlayer(s, "C", 2000);
    s = startHand(s, deck("2c 3d 4h 5s 6c 7d 8s 9h Tc"));
    expect(s.players.map((p) => p.userId).sort()).toEqual(["B", "C"]);
  });
});

describe("buildSidePots", () => {
  it("layers pots by contribution level", () => {
    const players: EnginePlayer[] = [
      { userId: "A", chips: 0, streetCommitted: 0, handCommitted: 100, status: "allin", hasActed: true },
      { userId: "B", chips: 0, streetCommitted: 0, handCommitted: 50, status: "allin", hasActed: true },
      { userId: "C", chips: 1900, streetCommitted: 0, handCommitted: 100, status: "active", hasActed: true },
    ];
    const pots = buildSidePots(players);
    expect(pots).toEqual([
      { amount: 150, eligible: ["A", "B", "C"] },
      { amount: 100, eligible: ["A", "C"] },
    ]);
  });
});
