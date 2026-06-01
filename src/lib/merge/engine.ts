import {
  BOARD_CELLS,
  ENERGY_MAX,
  ENERGY_PER_SPAWN,
  ENERGY_REGEN_MS,
  FAMILIES,
  GENERATOR_CELL,
  ORDER_ENERGY_REWARD,
  ORDER_MAX_TIER,
  ORDER_MIN_TIER,
  ORDER_REWARD_BY_TIER,
  ORDER_SLOTS,
  maxTier,
} from "@/lib/merge/config";
import type { MergeCell, MergeOp, MergeOrder, MergeState } from "@/lib/merge/types";

/** Pure, server-authoritative Merge Valley logic. No persistence, no I/O. */

/** Pick an integer in [0, n) from an rng in [0, 1). */
function pick(rng: () => number, n: number): number {
  return Math.min(n - 1, Math.floor(rng() * n));
}

/** A short pseudo-id derived from the rng (unique enough for board orders). */
function rngId(rng: () => number): string {
  return `o${Math.floor(rng() * 1e9).toString(36)}`;
}

/** A fresh tier-1 item from a random family. */
function randomTier1(rng: () => number): MergeCell {
  const family = FAMILIES[pick(rng, FAMILIES.length)]!;
  return { kind: "item", family: family.key, tier: 1 };
}

/** A new order for a random family + achievable tier. */
export function randomOrder(rng: () => number): MergeOrder {
  const family = FAMILIES[pick(rng, FAMILIES.length)]!;
  const span = ORDER_MAX_TIER - ORDER_MIN_TIER + 1;
  const tier = ORDER_MIN_TIER + pick(rng, span);
  return {
    id: rngId(rng),
    family: family.key,
    tier,
    reward: ORDER_REWARD_BY_TIER[tier] ?? 0,
  };
}

/** A brand-new board: a centred generator, empty cells, ORDER_SLOTS orders. */
export function createBoard(rng: () => number, nowIso: string): MergeState {
  const cells: MergeCell[] = Array.from({ length: BOARD_CELLS }, () => null);
  cells[GENERATOR_CELL] = { kind: "gen" };
  const orders = Array.from({ length: ORDER_SLOTS }, () => randomOrder(rng));
  return { cells, energy: ENERGY_MAX, energyAt: nowIso, orders, merges: 0, ordersFilled: 0 };
}

/** Indices of empty cells. */
export function freeCells(cells: MergeCell[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < cells.length; i++) if (cells[i] === null) out.push(i);
  return out;
}

/**
 * Lazily top up energy: +1 per ENERGY_REGEN_MS elapsed, capped at ENERGY_MAX.
 * Preserves the sub-interval remainder so regen doesn't drift; resets the clock
 * to `now` once full so a long absence can't bank a huge backlog.
 */
export function regenEnergy(state: MergeState, nowMs: number): MergeState {
  const last = Date.parse(state.energyAt);
  const nowIso = new Date(nowMs).toISOString();
  if (Number.isNaN(last)) return { ...state, energyAt: nowIso };
  if (state.energy >= ENERGY_MAX) return { ...state, energyAt: nowIso };

  const gained = Math.floor((nowMs - last) / ENERGY_REGEN_MS);
  if (gained <= 0) return state;

  const energy = Math.min(ENERGY_MAX, state.energy + gained);
  const energyAt =
    energy >= ENERGY_MAX
      ? nowIso
      : new Date(last + gained * ENERGY_REGEN_MS).toISOString();
  return { ...state, energy, energyAt };
}

/** Spend energy and spawn a random tier-1 item into a random free cell. */
export function tapGenerator(state: MergeState, rng: () => number): MergeOp {
  if (state.energy < ENERGY_PER_SPAWN) return { ok: false, reason: "no-energy" };
  const free = freeCells(state.cells);
  if (free.length === 0) return { ok: false, reason: "board-full" };

  const target = free[pick(rng, free.length)]!;
  const cells = [...state.cells];
  cells[target] = randomTier1(rng);
  return { ok: true, state: { ...state, cells, energy: state.energy - ENERGY_PER_SPAWN } };
}

function inRange(i: number): boolean {
  return Number.isInteger(i) && i >= 0 && i < BOARD_CELLS;
}

/**
 * Move an item onto an empty cell, or merge it into an identical one (one tier
 * up). The generator can't be moved or merged into. Bumps `merges` on a merge.
 */
export function moveOrMerge(state: MergeState, from: number, to: number): MergeOp {
  if (!inRange(from) || !inRange(to) || from === to) {
    return { ok: false, reason: "bad-cell" };
  }
  const a = state.cells[from];
  const b = state.cells[to];
  if (!a || a.kind !== "item") return { ok: false, reason: "bad-cell" };

  const cells = [...state.cells];

  // Move onto an empty cell.
  if (b === null) {
    cells[to] = a;
    cells[from] = null;
    return { ok: true, state: { ...state, cells } };
  }

  // Merge two identical items.
  if (b.kind === "item" && b.family === a.family && b.tier === a.tier) {
    if (a.tier >= maxTier(a.family)) return { ok: false, reason: "max-tier" };
    cells[to] = { kind: "item", family: a.family, tier: a.tier + 1 };
    cells[from] = null;
    return { ok: true, state: { ...state, cells, merges: state.merges + 1 } };
  }

  return { ok: false, reason: "not-mergeable" };
}

export type FulfilOp =
  | { ok: true; state: MergeState; reward: number }
  | { ok: false; reason: "no-order" | "no-item" };

/**
 * Deliver the item an order asks for: remove one matching item from the board,
 * replace the order with a fresh one, top up a little energy, and report the
 * coin reward (the caller awards it, capped by the hourly faucet).
 */
export function fulfillOrder(
  state: MergeState,
  orderId: string,
  rng: () => number,
): FulfilOp {
  const slot = state.orders.findIndex((o) => o.id === orderId);
  if (slot < 0) return { ok: false, reason: "no-order" };
  const order = state.orders[slot]!;

  const itemIdx = state.cells.findIndex(
    (c) => c?.kind === "item" && c.family === order.family && c.tier === order.tier,
  );
  if (itemIdx < 0) return { ok: false, reason: "no-item" };

  const cells = [...state.cells];
  cells[itemIdx] = null;
  const orders = [...state.orders];
  orders[slot] = randomOrder(rng);

  return {
    ok: true,
    reward: order.reward,
    state: {
      ...state,
      cells,
      orders,
      energy: Math.min(ENERGY_MAX, state.energy + ORDER_ENERGY_REWARD),
      ordersFilled: state.ordersFilled + 1,
    },
  };
}

/** Add bought energy (the bibcoin sink), capped at ENERGY_MAX. */
export function addEnergy(state: MergeState, amount: number): MergeState {
  return { ...state, energy: Math.min(ENERGY_MAX, state.energy + amount) };
}
