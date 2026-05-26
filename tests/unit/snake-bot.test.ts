import { describe, expect, it } from "vitest";

import { botDirection, buildCycleIndex } from "@/lib/games/snake/bot";
import {
  createInitialState,
  GRID,
  tick,
  type Direction,
  type SnakeState,
} from "@/lib/games/snake/engine";

const OPPOSITE: Record<Direction, Direction> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

/** Plays a bot-driven game until game over or `target` score is reached. */
function playBot(
  seed: number,
  target: number,
  maxTicks = 100_000,
): { score: number; gameOver: boolean; reversed: boolean } {
  let state: SnakeState = createInitialState(seed);
  let reversed = false;
  for (let i = 0; i < maxTicks && !state.gameOver && state.score < target; i++) {
    const dir = botDirection(state);
    if (state.snake.length > 1 && dir === OPPOSITE[state.dir]) reversed = true;
    state = tick({ ...state, inputQueue: [dir] });
  }
  return { score: state.score, gameOver: state.gameOver, reversed };
}

describe("Hamiltonian cycle", () => {
  it("visits every cell exactly once with adjacent consecutive steps", () => {
    const size = GRID;
    const order = buildCycleIndex(size);
    const n = size * size;

    // every position 0..n-1 used exactly once
    expect(new Set(order).size).toBe(n);
    expect(Math.min(...order)).toBe(0);
    expect(Math.max(...order)).toBe(n - 1);

    // reconstruct cell per position and check adjacency (incl. wrap-around)
    const cellAt: { x: number; y: number }[] = new Array(n);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) cellAt[order[y * size + x]!] = { x, y };
    }
    for (let i = 0; i < n; i++) {
      const a = cellAt[i]!;
      const b = cellAt[(i + 1) % n]!;
      expect(Math.abs(a.x - b.x) + Math.abs(a.y - b.y)).toBe(1);
    }
  });
});

describe("snake bot", () => {
  const seeds = [1, 7, 42];

  it("never reverses into its own neck", () => {
    for (const seed of seeds) {
      expect(playBot(seed, 250).reversed).toBe(false);
    }
  });

  it("plays deep into the board without dying", () => {
    for (const seed of seeds) {
      const result = playBot(seed, 250);
      expect(result.score).toBeGreaterThanOrEqual(250);
      expect(result.gameOver).toBe(false);
    }
  });
});
