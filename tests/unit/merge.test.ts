import { describe, expect, it } from "vitest";

import {
  BOARD_CELLS,
  ENERGY_MAX,
  ENERGY_REGEN_MS,
  GENERATOR_CELL,
  ORDER_MAX_TIER,
  ORDER_MIN_TIER,
  ORDER_REWARD_BY_TIER,
  ORDER_SLOTS,
} from "@/lib/merge/config";
import {
  addEnergy,
  createBoard,
  fulfillOrder,
  moveOrMerge,
  randomOrder,
  regenEnergy,
  tapGenerator,
} from "@/lib/merge/engine";
import type { MergeState } from "@/lib/merge/types";

/** Deterministic rng cycling through fixed values. */
function seqRng(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length]!;
}

const NOW = "2026-06-01T12:00:00.000Z";
const NOW_MS = Date.parse(NOW);

describe("createBoard", () => {
  it("starts full energy, a centred generator and ORDER_SLOTS orders", () => {
    const s = createBoard(seqRng([0.1, 0.2, 0.3]), NOW);
    expect(s.cells).toHaveLength(BOARD_CELLS);
    expect(s.cells[GENERATOR_CELL]).toEqual({ kind: "gen" });
    expect(s.energy).toBe(ENERGY_MAX);
    expect(s.orders).toHaveLength(ORDER_SLOTS);
    expect(s.cells.filter((c) => c !== null)).toHaveLength(1);
  });
});

describe("randomOrder", () => {
  it("requests an achievable tier with the matching reward", () => {
    for (let i = 0; i < 50; i++) {
      const o = randomOrder(seqRng([i / 50, (i * 3) / 50, (i * 7) / 50]));
      expect(o.tier).toBeGreaterThanOrEqual(ORDER_MIN_TIER);
      expect(o.tier).toBeLessThanOrEqual(ORDER_MAX_TIER);
      expect(o.reward).toBe(ORDER_REWARD_BY_TIER[o.tier]);
    }
  });
});

describe("tapGenerator", () => {
  it("spends one energy and spawns a tier-1 item on a free cell", () => {
    const s = createBoard(seqRng([0]), NOW);
    const op = tapGenerator(s, seqRng([0, 0]));
    expect(op.ok).toBe(true);
    if (!op.ok) return;
    expect(op.state.energy).toBe(ENERGY_MAX - 1);
    const items = op.state.cells.filter((c) => c?.kind === "item");
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ tier: 1 });
  });

  it("refuses when out of energy", () => {
    const s: MergeState = { ...createBoard(seqRng([0]), NOW), energy: 0 };
    const op = tapGenerator(s, seqRng([0]));
    expect(op).toEqual({ ok: false, reason: "no-energy" });
  });

  it("refuses when the board is full", () => {
    const base = createBoard(seqRng([0]), NOW);
    const full: MergeState = {
      ...base,
      cells: base.cells.map((c) => c ?? { kind: "item", family: "tuin", tier: 1 }),
    };
    expect(tapGenerator(full, seqRng([0]))).toEqual({ ok: false, reason: "board-full" });
  });
});

describe("moveOrMerge", () => {
  const item = (family: string, tier: number) =>
    ({ kind: "item", family, tier }) as const;

  function boardWith(overrides: Record<number, MergeState["cells"][number]>) {
    const s = createBoard(seqRng([0]), NOW);
    const cells = [...s.cells];
    for (const [i, c] of Object.entries(overrides)) cells[Number(i)] = c;
    return { ...s, cells };
  }

  it("moves an item onto an empty cell", () => {
    const s = boardWith({ 0: item("tuin", 1) });
    const op = moveOrMerge(s, 0, 1);
    expect(op.ok).toBe(true);
    if (!op.ok) return;
    expect(op.state.cells[0]).toBeNull();
    expect(op.state.cells[1]).toEqual(item("tuin", 1));
    expect(op.state.merges).toBe(0);
  });

  it("merges two identical items one tier up and counts the merge", () => {
    const s = boardWith({ 0: item("tuin", 2), 1: item("tuin", 2) });
    const op = moveOrMerge(s, 0, 1);
    expect(op.ok).toBe(true);
    if (!op.ok) return;
    expect(op.state.cells[0]).toBeNull();
    expect(op.state.cells[1]).toEqual(item("tuin", 3));
    expect(op.state.merges).toBe(1);
  });

  it("won't merge different families or tiers", () => {
    expect(moveOrMerge(boardWith({ 0: item("tuin", 1), 1: item("fruit", 1) }), 0, 1)).toEqual(
      { ok: false, reason: "not-mergeable" },
    );
    expect(moveOrMerge(boardWith({ 0: item("tuin", 1), 1: item("tuin", 2) }), 0, 1)).toEqual(
      { ok: false, reason: "not-mergeable" },
    );
  });

  it("won't merge at the max tier", () => {
    const s = boardWith({ 0: item("tuin", 6), 1: item("tuin", 6) });
    expect(moveOrMerge(s, 0, 1)).toEqual({ ok: false, reason: "max-tier" });
  });

  it("won't move the generator or an empty cell", () => {
    const s = createBoard(seqRng([0]), NOW);
    expect(moveOrMerge(s, GENERATOR_CELL, 0)).toEqual({ ok: false, reason: "bad-cell" });
    expect(moveOrMerge(s, 0, 1)).toEqual({ ok: false, reason: "bad-cell" });
  });
});

describe("fulfillOrder", () => {
  it("consumes a matching item, pays the reward and replaces the order", () => {
    const s = createBoard(seqRng([0]), NOW);
    const order = s.orders[0]!;
    const cells = [...s.cells];
    cells[0] = { kind: "item", family: order.family, tier: order.tier };
    const withItem: MergeState = { ...s, cells, energy: 10 };

    const op = fulfillOrder(withItem, order.id, seqRng([0.5, 0.5, 0.5]));
    expect(op.ok).toBe(true);
    if (!op.ok) return;
    expect(op.reward).toBe(order.reward);
    expect(op.state.cells[0]).toBeNull();
    expect(op.state.ordersFilled).toBe(1);
    expect(op.state.orders[0]!.id).not.toBe(order.id);
    expect(op.state.energy).toBeGreaterThan(10); // small energy top-up
  });

  it("fails without the requested item on the board", () => {
    const s = createBoard(seqRng([0]), NOW);
    expect(fulfillOrder(s, s.orders[0]!.id, seqRng([0])).ok).toBe(false);
  });

  it("fails for an unknown order id", () => {
    const s = createBoard(seqRng([0]), NOW);
    expect(fulfillOrder(s, "nope", seqRng([0]))).toEqual({ ok: false, reason: "no-order" });
  });
});

describe("regenEnergy", () => {
  it("adds one energy per interval and preserves the remainder", () => {
    const s: MergeState = { ...createBoard(seqRng([0]), NOW), energy: 10, energyAt: NOW };
    const later = NOW_MS + ENERGY_REGEN_MS * 3 + ENERGY_REGEN_MS / 2;
    const r = regenEnergy(s, later);
    expect(r.energy).toBe(13);
    // The half-interval remainder is kept (clock advanced by 3 intervals only).
    expect(Date.parse(r.energyAt)).toBe(NOW_MS + ENERGY_REGEN_MS * 3);
  });

  it("never exceeds the cap and resets the clock when full", () => {
    const s: MergeState = { ...createBoard(seqRng([0]), NOW), energy: ENERGY_MAX - 1, energyAt: NOW };
    const later = NOW_MS + ENERGY_REGEN_MS * 100;
    const r = regenEnergy(s, later);
    expect(r.energy).toBe(ENERGY_MAX);
    expect(Date.parse(r.energyAt)).toBe(later);
  });
});

describe("addEnergy", () => {
  it("caps at ENERGY_MAX", () => {
    const s: MergeState = { ...createBoard(seqRng([0]), NOW), energy: ENERGY_MAX - 5 };
    expect(addEnergy(s, 50).energy).toBe(ENERGY_MAX);
  });
});
