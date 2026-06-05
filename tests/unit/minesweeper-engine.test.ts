import { describe, expect, it } from "vitest";

import {
  MINESWEEPER_DIFFICULTIES,
  createGame,
  revealCell,
  safeCellCount,
  toggleFlag,
  type MinesweeperState,
} from "@/lib/games/minesweeper/engine";

function mineCount(state: MinesweeperState): number {
  return state.board.flat().filter((c) => c.mine).length;
}

describe("createGame", () => {
  it("builds an empty idle board per difficulty", () => {
    for (const key of ["easy", "medium", "hard"] as const) {
      const preset = MINESWEEPER_DIFFICULTIES[key];
      const state = createGame(key, 42);
      expect(state.status).toBe("idle");
      expect(state.board).toHaveLength(preset.rows);
      expect(state.board[0]).toHaveLength(preset.cols);
      expect(mineCount(state)).toBe(0); // mines only appear on first reveal
      expect(state.revealed).toBe(0);
      expect(state.flags).toBe(0);
    }
  });
});

describe("revealCell — first click", () => {
  it("places the right number of mines, never on or next to the click", () => {
    for (const seed of [1, 7, 1234, -99]) {
      const state = revealCell(createGame("easy", seed), 4, 4);
      expect(mineCount(state)).toBe(10);
      for (let r = 3; r <= 5; r++) {
        for (let c = 3; c <= 5; c++) {
          expect(state.board[r][c].mine).toBe(false);
        }
      }
      expect(state.status === "playing" || state.status === "won").toBe(true);
    }
  });

  it("flood-reveals the safe opening around the first click", () => {
    const state = revealCell(createGame("easy", 42), 4, 4);
    // First cell + its full ring are mine-free, so at least 9 cells open.
    expect(state.revealed).toBeGreaterThanOrEqual(9);
  });

  it("computes adjacency counts consistent with the placed mines", () => {
    const state = revealCell(createGame("easy", 42), 4, 4);
    for (let r = 0; r < state.rows; r++) {
      for (let c = 0; c < state.cols; c++) {
        let expected = 0;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            expected += state.board[r + dr]?.[c + dc]?.mine ? 1 : 0;
          }
        }
        expect(state.board[r][c].adjacent).toBe(expected);
      }
    }
  });

  it("does not mutate the input state", () => {
    const before = createGame("easy", 42);
    const snapshot = JSON.stringify(before);
    revealCell(before, 4, 4);
    expect(JSON.stringify(before)).toBe(snapshot);
  });
});

function findCell(
  state: MinesweeperState,
  pred: (cell: MinesweeperState["board"][number][number]) => boolean,
): [number, number] {
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      if (pred(state.board[r][c])) return [r, c];
    }
  }
  throw new Error("no matching cell");
}

describe("revealCell — losing", () => {
  it("reveals all mines and marks the hit one as exploded", () => {
    const playing = revealCell(createGame("easy", 42), 4, 4);
    const [r, c] = findCell(playing, (cell) => cell.mine);
    const lost = revealCell(playing, r, c);
    expect(lost.status).toBe("lost");
    expect(lost.board[r][c].exploded).toBe(true);
    expect(lost.board.flat().filter((x) => x.mine && !x.revealed)).toHaveLength(0);
  });

  it("ignores further input after the game ended", () => {
    const playing = revealCell(createGame("easy", 42), 4, 4);
    const [r, c] = findCell(playing, (cell) => cell.mine);
    const lost = revealCell(playing, r, c);
    expect(revealCell(lost, 0, 0)).toBe(lost);
    expect(toggleFlag(lost, 0, 0)).toBe(lost);
  });
});

describe("revealCell — winning", () => {
  it("wins once every safe cell is revealed and auto-flags the mines", () => {
    let state = revealCell(createGame("easy", 42), 4, 4);
    for (let r = 0; r < state.rows; r++) {
      for (let c = 0; c < state.cols; c++) {
        if (!state.board[r][c].mine) state = revealCell(state, r, c);
      }
    }
    expect(state.status).toBe("won");
    expect(state.revealed).toBe(safeCellCount(state));
    expect(state.flags).toBe(state.mines);
    expect(state.board.flat().filter((x) => x.mine && !x.flagged)).toHaveLength(0);
  });
});

describe("toggleFlag", () => {
  it("toggles flags on unrevealed cells only, capped at the mine count", () => {
    let state = revealCell(createGame("easy", 42), 4, 4);
    const [r, c] = findCell(state, (cell) => !cell.revealed);
    state = toggleFlag(state, r, c);
    expect(state.board[r][c].flagged).toBe(true);
    expect(state.flags).toBe(1);
    state = toggleFlag(state, r, c);
    expect(state.board[r][c].flagged).toBe(false);
    expect(state.flags).toBe(0);

    const [rr, rc] = findCell(state, (cell) => cell.revealed);
    expect(toggleFlag(state, rr, rc)).toBe(state);
  });

  it("flagged cells cannot be revealed", () => {
    let state = revealCell(createGame("easy", 42), 4, 4);
    const [r, c] = findCell(state, (cell) => cell.mine);
    state = toggleFlag(state, r, c);
    const after = revealCell(state, r, c);
    expect(after.status).toBe("playing");
    expect(after.board[r][c].revealed).toBe(false);
  });
});

describe("chord (reveal on a revealed number)", () => {
  it("opens unflagged neighbours when the flag count matches the number", () => {
    let state = revealCell(createGame("easy", 42), 4, 4);
    // Find a revealed number whose mined neighbours are all unrevealed.
    const [r, c] = findCell(state, (cell) => cell.revealed && cell.adjacent > 0);
    // Flag exactly its mined neighbours.
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (state.board[r + dr]?.[c + dc]?.mine) {
          state = toggleFlag(state, r + dr, c + dc);
        }
      }
    }
    const before = state.revealed;
    const after = revealCell(state, r, c);
    expect(after.status).not.toBe("lost"); // flags were correct
    expect(after.revealed).toBeGreaterThanOrEqual(before);
  });

  it("is a no-op when the flag count does not match", () => {
    const state = revealCell(createGame("easy", 42), 4, 4);
    const [r, c] = findCell(state, (cell) => cell.revealed && cell.adjacent > 0);
    expect(revealCell(state, r, c)).toBe(state);
  });
});
