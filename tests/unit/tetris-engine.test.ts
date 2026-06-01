import { describe, expect, it } from "vitest";

import {
  COLS,
  ROWS,
  cellsOf,
  createInitialState,
  hardDrop,
  moveLeft,
  moveRight,
  tick,
  type TetrisState,
} from "@/lib/games/tetris/engine";

function emptyBoard(): number[][] {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

describe("tetris engine — initial state", () => {
  it("starts with an empty board and a spawned piece", () => {
    const s = createInitialState(42);
    expect(s.board).toHaveLength(ROWS);
    expect(s.board[0]).toHaveLength(COLS);
    expect(s.lines).toBe(0);
    expect(s.gameOver).toBe(false);
    expect(cellsOf(s.active).length).toBe(4);
  });

  it("is deterministic for the same seed", () => {
    expect(createInitialState(9).active.type).toBe(
      createInitialState(9).active.type,
    );
  });
});

describe("tetris engine — movement", () => {
  it("moves left and right within the walls", () => {
    const s = createInitialState(42);
    expect(moveLeft(s).active.x).toBe(s.active.x - 1);
    expect(moveRight(s).active.x).toBe(s.active.x + 1);
  });

  it("gravity moves the active piece down one row", () => {
    const s = createInitialState(42);
    expect(tick(s).active.y).toBe(s.active.y + 1);
  });
});

describe("tetris engine — line clear", () => {
  it("clears a completed row and counts it", () => {
    const board = emptyBoard();
    for (let x = 0; x < COLS; x++) {
      if (x !== 4 && x !== 5) board[ROWS - 1][x] = 1;
    }
    const state: TetrisState = {
      board,
      active: { type: "O", rot: 0, x: 4, y: 0 },
      bag: ["I", "T", "S", "Z", "J", "L"],
      rngSeed: 1,
      lines: 0,
      gameOver: false,
      tickCount: 0,
    };
    const after = hardDrop(state);
    expect(after.lines).toBe(1);
    expect(after.board[ROWS - 1].filter((c) => c !== 0).length).toBeLessThan(
      COLS,
    );
  });
});

describe("tetris engine — game over", () => {
  it("ends when a fresh piece cannot spawn", () => {
    const board = emptyBoard();
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS - 1; x++) board[y][x] = 1; // col 9 empty: no clears
    }
    const state: TetrisState = {
      board,
      active: { type: "O", rot: 0, x: 4, y: 0 },
      bag: ["T", "I", "S", "Z", "J", "L"],
      rngSeed: 1,
      lines: 0,
      gameOver: false,
      tickCount: 0,
    };
    expect(hardDrop(state).gameOver).toBe(true);
  });
});
