import { describe, expect, it } from "vitest";

import {
  canMove,
  createInitialState,
  move,
  slideRowLeft,
  type Game2048State,
} from "@/lib/games/twenty48/engine";

describe("2048 engine — row slide", () => {
  it("merges equal neighbours once, leftwards", () => {
    expect(slideRowLeft([2, 2, 0, 0])).toEqual([4, 0, 0, 0]);
    expect(slideRowLeft([2, 0, 2, 0])).toEqual([4, 0, 0, 0]);
    expect(slideRowLeft([2, 2, 2, 2])).toEqual([4, 4, 0, 0]);
    expect(slideRowLeft([4, 4, 2, 2])).toEqual([8, 4, 0, 0]);
    expect(slideRowLeft([2, 0, 0, 0])).toEqual([2, 0, 0, 0]);
  });
});

describe("2048 engine — initial state", () => {
  it("seeds exactly two tiles, deterministically", () => {
    const a = createInitialState(42);
    expect(a.grid.flat().filter((n) => n !== 0)).toHaveLength(2);
    expect(a.gameOver).toBe(false);
    expect(createInitialState(42).grid).toEqual(a.grid);
  });
});

describe("2048 engine — move", () => {
  it("spawns a new tile only when the board changes", () => {
    const grid = [
      [2, 2, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const state: Game2048State = {
      grid,
      highestTile: 2,
      gameOver: false,
      rngSeed: 1,
      moves: 0,
    };
    const moved = move(state, "left");
    expect(moved.grid[0][0]).toBe(4);
    expect(moved.grid.flat().filter((n) => n !== 0).length).toBe(2);
    expect(moved.highestTile).toBe(4);
  });

  it("returns the same board (no spawn) when nothing moves", () => {
    const grid = [
      [4, 2, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const state: Game2048State = {
      grid,
      highestTile: 4,
      gameOver: false,
      rngSeed: 1,
      moves: 0,
    };
    expect(move(state, "left").grid).toEqual(grid);
  });
});

describe("2048 engine — game over", () => {
  it("detects a full, unmergeable board", () => {
    expect(
      canMove([
        [2, 4, 2, 4],
        [4, 2, 4, 2],
        [2, 4, 2, 4],
        [4, 2, 4, 2],
      ]),
    ).toBe(false);
  });

  it("allows a move when neighbours can merge", () => {
    expect(
      canMove([
        [2, 2, 4, 8],
        [4, 8, 16, 32],
        [2, 4, 8, 16],
        [4, 8, 16, 32],
      ]),
    ).toBe(true);
  });
});
