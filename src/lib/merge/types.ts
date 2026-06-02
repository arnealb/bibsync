/** A single board cell: empty, the permanent generator, or a merge item. */
export type MergeCell =
  | null
  | { kind: "gen" }
  | { kind: "item"; family: string; tier: number };

/** An order requesting one item in exchange for coins + a little energy. */
export interface MergeOrder {
  id: string;
  family: string;
  tier: number;
  /** Coins paid on delivery (capped by the hourly faucet at award time). */
  reward: number;
}

/** Full persisted state of a player's Merge Valley board. */
export interface MergeState {
  /** Flat board, length BOARD_CELLS. */
  cells: MergeCell[];
  /** Current energy. */
  energy: number;
  /** ISO timestamp the energy total was last reconciled (for lazy regen). */
  energyAt: string;
  /** Open orders. */
  orders: MergeOrder[];
  /** Lifetime stats (for flavour / achievements). */
  merges: number;
  ordersFilled: number;
}

/** Outcome of a pure engine operation. */
export type MergeOp =
  | { ok: true; state: MergeState }
  | { ok: false; reason: MergeError };

export type MergeError =
  | "no-energy"
  | "board-full"
  | "not-mergeable"
  | "max-tier"
  | "bad-cell"
  | "no-order"
  | "no-item";
