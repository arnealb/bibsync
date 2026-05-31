import { describe, expect, it } from "vitest";

import { LOTTERY_TICKET_PRICE } from "@/lib/lottery/config";
import {
  addTickets,
  drawWinner,
  initialLottery,
  ticketsFor,
  totalTickets,
} from "@/lib/lottery/engine";

describe("addTickets", () => {
  it("adds tickets and grows the pot", () => {
    let s = initialLottery();
    s = addTickets(s, "a", 3, LOTTERY_TICKET_PRICE);
    expect(ticketsFor(s, "a")).toBe(3);
    expect(s.pot).toBe(3 * LOTTERY_TICKET_PRICE);
    expect(totalTickets(s)).toBe(3);
  });

  it("stacks repeat buys for the same user", () => {
    let s = initialLottery();
    s = addTickets(s, "a", 2, LOTTERY_TICKET_PRICE);
    s = addTickets(s, "a", 3, LOTTERY_TICKET_PRICE);
    expect(ticketsFor(s, "a")).toBe(5);
    expect(s.tickets).toHaveLength(1);
  });

  it("tracks multiple players", () => {
    let s = initialLottery();
    s = addTickets(s, "a", 1, LOTTERY_TICKET_PRICE);
    s = addTickets(s, "b", 4, LOTTERY_TICKET_PRICE);
    expect(s.tickets).toHaveLength(2);
    expect(totalTickets(s)).toBe(5);
    expect(s.pot).toBe(5 * LOTTERY_TICKET_PRICE);
  });
});

describe("drawWinner (reference weighting)", () => {
  it("is weighted by ticket count", () => {
    let s = initialLottery();
    s = addTickets(s, "a", 1, LOTTERY_TICKET_PRICE); // ticket 0
    s = addTickets(s, "b", 3, LOTTERY_TICKET_PRICE); // tickets 1..3
    expect(drawWinner(s, () => 0)).toBe("a"); // pick 0 → a
    expect(drawWinner(s, () => 0.5)).toBe("b"); // pick 2 → b
    expect(drawWinner(s, () => 0.99)).toBe("b"); // pick 3 → b
  });
});
