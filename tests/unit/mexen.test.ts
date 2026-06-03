import { describe, expect, it } from "vitest";

import {
  compareThrows,
  rollDie,
  roundOutcome,
  scoreThrow,
  throwEffects,
  type PlayerThrow,
} from "@/lib/mexen/engine";
import {
  reorderLoserFirst,
  resolveRound,
  type MexenPlayer,
} from "@/lib/mexen/game";

describe("scoreThrow", () => {
  it("reads the higher pip as the tens digit regardless of order", () => {
    expect(scoreThrow([1, 5]).number).toBe(51);
    expect(scoreThrow([5, 1]).number).toBe(51);
  });

  it("recognises Mexen (21) as the single highest throw", () => {
    const mexen = scoreThrow([2, 1]);
    expect(mexen.isMexen).toBe(true);
    expect(mexen.category).toBe("mexen");
    // Beats the best double and the best normal.
    expect(compareThrows(mexen, scoreThrow([6, 6]))).toBeGreaterThan(0);
    expect(compareThrows(mexen, scoreThrow([6, 5]))).toBeGreaterThan(0);
  });

  it("ranks every double above every normal number", () => {
    expect(compareThrows(scoreThrow([1, 1]), scoreThrow([6, 5]))).toBeGreaterThan(0);
    expect(compareThrows(scoreThrow([6, 6]), scoreThrow([5, 5]))).toBeGreaterThan(0);
  });

  it("orders normal numbers by their two-digit value (31 is the lowest)", () => {
    expect(compareThrows(scoreThrow([6, 5]), scoreThrow([3, 1]))).toBeGreaterThan(0);
    expect(scoreThrow([3, 1]).is31).toBe(true);
    expect(scoreThrow([3, 1]).category).toBe("normal");
  });

  it("flags snake eyes (11) as a double that makes a honderdman", () => {
    const s = scoreThrow([1, 1]);
    expect(s.isSnakeEyes).toBe(true);
    expect(s.isDouble).toBe(true);
    expect(s.pip).toBe(1);
  });
});

describe("throwEffects", () => {
  it("the first 11 makes a honderdman; later doubles make the honderdman drink", () => {
    const eleven = throwEffects(scoreThrow([1, 1]), false);
    expect(eleven.makesHonderdman).toBe(true);
    // Its own creating throw doesn't penalise the new honderdman.
    expect(eleven.honderdmanDrinksSips).toBe(0);

    const laterDouble = throwEffects(scoreThrow([3, 3]), true);
    expect(laterDouble.honderdmanDrinksSips).toBe(3);
    expect(laterDouble.makesHonderdman).toBe(false);
  });

  it("a double makes the thrower drink the pip in sips", () => {
    expect(throwEffects(scoreThrow([4, 4]), false).drinkSips).toBe(4);
    expect(throwEffects(scoreThrow([6, 5]), false).drinkSips).toBe(0);
  });

  it("31 lets the thrower deal out a half atje", () => {
    expect(throwEffects(scoreThrow([3, 1]), false).dealHalf).toBe(true);
    expect(throwEffects(scoreThrow([3, 2]), false).dealHalf).toBe(false);
  });
});

describe("roundOutcome", () => {
  const t = (playerId: string, dice: [number, number]): PlayerThrow => ({
    playerId,
    score: scoreThrow(dice),
  });

  it("picks the lowest throw as loser and highest as winner", () => {
    const r = roundOutcome([t("a", [6, 5]), t("b", [3, 1]), t("c", [4, 2])]);
    expect(r.loserIds).toEqual(["b"]);
    expect(r.winnerIds).toEqual(["a"]);
    expect(r.loserAtjes).toBe(1);
  });

  it("doubles the loser's atjes when the winning throw is a Mexen", () => {
    const r = roundOutcome([t("a", [2, 1]), t("b", [3, 1])]);
    expect(r.winnerIds).toEqual(["a"]);
    expect(r.loserAtjes).toBe(2);
  });

  it("returns all tied players on both ends", () => {
    const r = roundOutcome([t("a", [4, 2]), t("b", [4, 2]), t("c", [3, 1])]);
    expect(r.winnerIds.sort()).toEqual(["a", "b"]);
    expect(r.loserIds).toEqual(["c"]);
  });
});

describe("resolveRound", () => {
  it("makes the first 11-thrower honderdman and later doubles hit them", () => {
    const r = resolveRound(
      [
        { playerId: "a", dice: [1, 1] }, // becomes honderdman
        { playerId: "b", dice: [3, 3] }, // double → honderdman a drinks 3
      ],
      null,
    );
    expect(r.honderdmanId).toBe("a");
    expect(r.perPlayer[0].effects.makesHonderdman).toBe(true);
    expect(r.perPlayer[1].honderdmanDrinkerId).toBe("a");
    expect(r.perPlayer[1].effects.honderdmanDrinksSips).toBe(3);
  });

  it("keeps an existing honderdman across rounds", () => {
    const r = resolveRound([{ playerId: "b", dice: [2, 2] }], "a");
    expect(r.honderdmanId).toBe("a");
    expect(r.perPlayer[0].honderdmanDrinkerId).toBe("a");
  });
});

describe("reorderLoserFirst", () => {
  const p = (id: string): MexenPlayer => ({
    id,
    name: id,
    avatarUrl: null,
    loadout: null,
  });

  it("rotates so the loser leads the next round", () => {
    const order = [p("a"), p("b"), p("c")];
    expect(reorderLoserFirst(order, "c").map((x) => x.id)).toEqual([
      "c",
      "a",
      "b",
    ]);
  });

  it("is a no-op when the loser already leads or isn't found", () => {
    const order = [p("a"), p("b")];
    expect(reorderLoserFirst(order, "a").map((x) => x.id)).toEqual(["a", "b"]);
    expect(reorderLoserFirst(order, "z").map((x) => x.id)).toEqual(["a", "b"]);
  });
});

describe("rollDie", () => {
  it("stays within 1..6 across the RNG range", () => {
    expect(rollDie(() => 0)).toBe(1);
    expect(rollDie(() => 0.999999)).toBe(6);
    for (let i = 0; i < 1000; i++) {
      const d = rollDie(Math.random);
      expect(d).toBeGreaterThanOrEqual(1);
      expect(d).toBeLessThanOrEqual(6);
    }
  });
});
