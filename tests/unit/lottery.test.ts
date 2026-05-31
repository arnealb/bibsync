import { describe, expect, it } from "vitest";

import { LOTTERY_TICKET_PRICE } from "@/lib/lottery/config";
import {
  addTickets,
  canDraw,
  drawWinner,
  initialLottery,
  resolveLottery,
  startRound,
  ticketsFor,
  totalTickets,
} from "@/lib/lottery/engine";

const NOW = "2026-05-31T12:00:00.000Z";

describe("addTickets", () => {
  it("adds tickets and grows the pot", () => {
    let s = initialLottery();
    s = addTickets(s, "a", 3, LOTTERY_TICKET_PRICE, NOW);
    expect(ticketsFor(s, "a")).toBe(3);
    expect(s.pot).toBe(3 * LOTTERY_TICKET_PRICE);
    expect(totalTickets(s)).toBe(3);
  });

  it("starts the countdown only at 2 distinct players", () => {
    let s = initialLottery();
    s = addTickets(s, "a", 5, LOTTERY_TICKET_PRICE, NOW);
    expect(s.endsAt).toBeNull(); // lonely buyer, no timer yet
    s = addTickets(s, "b", 1, LOTTERY_TICKET_PRICE, NOW);
    expect(s.endsAt).not.toBeNull();
  });

  it("stacks repeat buys for the same user", () => {
    let s = initialLottery();
    s = addTickets(s, "a", 2, LOTTERY_TICKET_PRICE, NOW);
    s = addTickets(s, "a", 3, LOTTERY_TICKET_PRICE, NOW);
    expect(ticketsFor(s, "a")).toBe(5);
    expect(s.tickets).toHaveLength(1);
  });
});

describe("canDraw", () => {
  it("needs at least two participants", () => {
    let s = addTickets(initialLottery(), "a", 1, LOTTERY_TICKET_PRICE, NOW);
    expect(canDraw(s)).toBe(false);
    s = addTickets(s, "b", 1, LOTTERY_TICKET_PRICE, NOW);
    expect(canDraw(s)).toBe(true);
  });
});

describe("drawWinner", () => {
  it("is weighted by ticket count", () => {
    let s = initialLottery();
    s = addTickets(s, "a", 1, LOTTERY_TICKET_PRICE, NOW); // ticket 0
    s = addTickets(s, "b", 3, LOTTERY_TICKET_PRICE, NOW); // tickets 1..3
    expect(drawWinner(s, () => 0)).toBe("a"); // pick 0 → a
    expect(drawWinner(s, () => 0.5)).toBe("b"); // pick 2 → b
    expect(drawWinner(s, () => 0.99)).toBe("b"); // pick 3 → b
  });
});

describe("resolveLottery", () => {
  it("pays the whole pot to the winner (no rake)", () => {
    let s = initialLottery();
    s = addTickets(s, "a", 1, LOTTERY_TICKET_PRICE, NOW);
    s = addTickets(s, "b", 1, LOTTERY_TICKET_PRICE, NOW);
    const drawn = resolveLottery(s, () => 0, NOW);
    expect(drawn.phase).toBe("drawn");
    expect(drawn.winnerId).toBe("a");
    expect(drawn.prize).toBe(s.pot);
  });
});

describe("startRound", () => {
  it("opens a fresh round with an incremented number", () => {
    let s = initialLottery();
    s = addTickets(s, "a", 1, LOTTERY_TICKET_PRICE, NOW);
    const next = startRound(resolveLottery(s, () => 0, NOW));
    expect(next.roundNo).toBe(2);
    expect(next.phase).toBe("open");
    expect(next.pot).toBe(0);
    expect(next.tickets).toHaveLength(0);
  });
});
