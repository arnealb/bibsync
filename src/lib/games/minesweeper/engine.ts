/**
 * Pure Minesweeper engine. Mines are placed on the FIRST reveal (excluding the
 * clicked cell and its neighbours) so the first click can never lose. All
 * functions return new state objects — input state is never mutated.
 */

export type MinesweeperDifficulty = "easy" | "medium" | "hard";
export type MinesweeperStatus = "idle" | "playing" | "won" | "lost";

export interface MinesweeperCell {
  mine: boolean;
  revealed: boolean;
  flagged: boolean;
  /** Number of neighbouring mines (0–8); only meaningful once mines exist. */
  adjacent: number;
  /** The mine that ended the game (rendered red on loss). */
  exploded: boolean;
}

export interface MinesweeperState {
  difficulty: MinesweeperDifficulty;
  rows: number;
  cols: number;
  mines: number;
  status: MinesweeperStatus;
  board: MinesweeperCell[][];
  /** Safe cells revealed so far — this is the submitted score. */
  revealed: number;
  flags: number;
  rngSeed: number;
}

export const MINESWEEPER_DIFFICULTIES: Record<
  MinesweeperDifficulty,
  { rows: number; cols: number; mines: number }
> = {
  easy: { rows: 9, cols: 9, mines: 10 },
  medium: { rows: 13, cols: 11, mines: 24 },
  hard: { rows: 17, cols: 13, mines: 44 },
};

function nextRng(seed: number): [number, number] {
  let s = seed | 0;
  if (s === 0) s = 1;
  s ^= s << 13;
  s ^= s >>> 17;
  s ^= s << 5;
  return [s | 0, ((s >>> 0) % 1_000_000) / 1_000_000];
}

function emptyCell(): MinesweeperCell {
  return { mine: false, revealed: false, flagged: false, adjacent: 0, exploded: false };
}

export function createGame(
  difficulty: MinesweeperDifficulty,
  seed: number,
): MinesweeperState {
  const { rows, cols, mines } = MINESWEEPER_DIFFICULTIES[difficulty];
  const board = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, emptyCell),
  );
  return {
    difficulty,
    rows,
    cols,
    mines,
    status: "idle",
    board,
    revealed: 0,
    flags: 0,
    rngSeed: seed,
  };
}

/** Total non-mine cells — revealing them all wins the game. */
export function safeCellCount(state: MinesweeperState): number {
  return state.rows * state.cols - state.mines;
}

function neighbours(
  rows: number,
  cols: number,
  r: number,
  c: number,
): [number, number][] {
  const out: [number, number][] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) out.push([nr, nc]);
    }
  }
  return out;
}

function copyBoard(board: MinesweeperCell[][]): MinesweeperCell[][] {
  return board.map((row) => row.map((cell) => ({ ...cell })));
}

/** Place mines on a fresh board copy, never on the first click or its ring. */
function placeMines(
  state: MinesweeperState,
  firstR: number,
  firstC: number,
): { board: MinesweeperCell[][]; rngSeed: number } {
  const board = copyBoard(state.board);
  const protectedKeys = new Set<number>([firstR * state.cols + firstC]);
  for (const [nr, nc] of neighbours(state.rows, state.cols, firstR, firstC)) {
    protectedKeys.add(nr * state.cols + nc);
  }

  const candidates: number[] = [];
  for (let i = 0; i < state.rows * state.cols; i++) {
    if (!protectedKeys.has(i)) candidates.push(i);
  }

  // Fisher–Yates with the seeded rng, then take the first `mines` cells.
  let s = state.rngSeed;
  for (let i = candidates.length - 1; i > 0; i--) {
    const [next, r] = nextRng(s);
    s = next;
    const j = Math.floor(r * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  for (const key of candidates.slice(0, state.mines)) {
    board[Math.floor(key / state.cols)][key % state.cols].mine = true;
  }

  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      board[r][c].adjacent = neighbours(state.rows, state.cols, r, c).filter(
        ([nr, nc]) => board[nr][nc].mine,
      ).length;
    }
  }
  return { board, rngSeed: s };
}

/** Flood-reveal on a board copy; returns the number of newly revealed cells. */
function floodReveal(
  board: MinesweeperCell[][],
  rows: number,
  cols: number,
  startR: number,
  startC: number,
): number {
  const stack: [number, number][] = [[startR, startC]];
  let opened = 0;
  while (stack.length > 0) {
    const [r, c] = stack.pop()!;
    const cell = board[r][c];
    if (cell.revealed || cell.flagged || cell.mine) continue;
    cell.revealed = true;
    opened += 1;
    if (cell.adjacent === 0) {
      for (const [nr, nc] of neighbours(rows, cols, r, c)) stack.push([nr, nc]);
    }
  }
  return opened;
}

/** Game over (loss): show every mine, mark the fatal one. */
function loseState(
  state: MinesweeperState,
  board: MinesweeperCell[][],
  hitR: number,
  hitC: number,
  opened: number,
): MinesweeperState {
  for (const row of board) {
    for (const cell of row) {
      if (cell.mine) cell.revealed = true;
    }
  }
  board[hitR][hitC].exploded = true;
  return { ...state, board, status: "lost", revealed: state.revealed + opened };
}

/** Win: flag every remaining mine, like the classic game does. */
function winState(
  state: MinesweeperState,
  board: MinesweeperCell[][],
  opened: number,
): MinesweeperState {
  for (const row of board) {
    for (const cell of row) {
      if (cell.mine) cell.flagged = true;
    }
  }
  return {
    ...state,
    board,
    status: "won",
    revealed: state.revealed + opened,
    flags: state.mines,
  };
}

function finishReveal(
  state: MinesweeperState,
  board: MinesweeperCell[][],
  opened: number,
): MinesweeperState {
  if (state.revealed + opened >= safeCellCount(state)) {
    return winState(state, board, opened);
  }
  return {
    ...state,
    board,
    status: "playing",
    revealed: state.revealed + opened,
  };
}

/**
 * Reveal a cell. On the first reveal mines are placed first (never under or
 * next to the click). Revealing a flagged cell is a no-op; revealing an
 * already-revealed number performs a "chord" when its flag count matches.
 */
export function revealCell(
  state: MinesweeperState,
  r: number,
  c: number,
): MinesweeperState {
  if (state.status === "won" || state.status === "lost") return state;
  if (r < 0 || r >= state.rows || c < 0 || c >= state.cols) return state;

  const cell = state.board[r][c];
  if (cell.flagged) return state;
  if (cell.revealed) return chord(state, r, c);

  let board: MinesweeperCell[][];
  let rngSeed = state.rngSeed;
  if (state.status === "idle") {
    const placed = placeMines(state, r, c);
    board = placed.board;
    rngSeed = placed.rngSeed;
  } else {
    board = copyBoard(state.board);
  }
  const next = { ...state, rngSeed };

  if (board[r][c].mine) return loseState(next, board, r, c, 0);
  const opened = floodReveal(board, state.rows, state.cols, r, c);
  return finishReveal(next, board, opened);
}

/** Classic chord: a revealed number with exactly that many flags around it
 * opens all remaining unflagged neighbours (a wrong flag loses the game). */
function chord(state: MinesweeperState, r: number, c: number): MinesweeperState {
  const cell = state.board[r][c];
  if (cell.adjacent === 0) return state;
  const around = neighbours(state.rows, state.cols, r, c);
  const flagCount = around.filter(([nr, nc]) => state.board[nr][nc].flagged).length;
  if (flagCount !== cell.adjacent) return state;

  const board = copyBoard(state.board);
  let opened = 0;
  for (const [nr, nc] of around) {
    const n = board[nr][nc];
    if (n.revealed || n.flagged) continue;
    if (n.mine) return loseState(state, board, nr, nc, opened);
    opened += floodReveal(board, state.rows, state.cols, nr, nc);
  }
  if (opened === 0) return state;
  return finishReveal(state, board, opened);
}

/** Toggle a flag on an unrevealed cell (capped at the mine count). */
export function toggleFlag(
  state: MinesweeperState,
  r: number,
  c: number,
): MinesweeperState {
  if (state.status === "won" || state.status === "lost") return state;
  if (r < 0 || r >= state.rows || c < 0 || c >= state.cols) return state;
  const cell = state.board[r][c];
  if (cell.revealed) return state;
  if (!cell.flagged && state.flags >= state.mines) return state;

  const board = copyBoard(state.board);
  board[r][c].flagged = !cell.flagged;
  return { ...state, board, flags: state.flags + (cell.flagged ? -1 : 1) };
}
