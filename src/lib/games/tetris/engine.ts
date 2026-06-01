export const COLS = 10;
export const ROWS = 20;

export type PieceType = "I" | "O" | "T" | "S" | "Z" | "J" | "L";

export interface ActivePiece {
  type: PieceType;
  rot: number;
  x: number;
  y: number;
}

export interface TetrisState {
  board: number[][]; // ROWS x COLS, 0 = empty else a colour id (1..7)
  active: ActivePiece;
  bag: PieceType[];
  lines: number;
  gameOver: boolean;
  rngSeed: number;
  tickCount: number;
}

const ALL_PIECES: PieceType[] = ["I", "O", "T", "S", "Z", "J", "L"];

/** Colour id per piece, used by the renderer. */
export const PIECE_ID: Record<PieceType, number> = {
  I: 1, O: 2, T: 3, S: 4, Z: 5, J: 6, L: 7,
};

/** Spawn-orientation cells inside a `size`x`size` box. */
const PIECES: Record<PieceType, { size: number; cells: [number, number][] }> = {
  I: { size: 4, cells: [[0, 1], [1, 1], [2, 1], [3, 1]] },
  O: { size: 2, cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  T: { size: 3, cells: [[1, 0], [0, 1], [1, 1], [2, 1]] },
  S: { size: 3, cells: [[1, 0], [2, 0], [0, 1], [1, 1]] },
  Z: { size: 3, cells: [[0, 0], [1, 0], [1, 1], [2, 1]] },
  J: { size: 3, cells: [[0, 0], [0, 1], [1, 1], [2, 1]] },
  L: { size: 3, cells: [[2, 0], [0, 1], [1, 1], [2, 1]] },
};

function nextRng(seed: number): [number, number] {
  let s = seed | 0;
  if (s === 0) s = 1;
  s ^= s << 13;
  s ^= s >>> 17;
  s ^= s << 5;
  return [s | 0, ((s >>> 0) % 1_000_000) / 1_000_000];
}

function rotatedCells(type: PieceType, rot: number): [number, number][] {
  const { size, cells } = PIECES[type];
  let cs = cells;
  const times = ((rot % 4) + 4) % 4;
  for (let r = 0; r < times; r++) {
    cs = cs.map(([x, y]) => [size - 1 - y, x] as [number, number]);
  }
  return cs;
}

/** Absolute board cells occupied by a piece. */
export function cellsOf(piece: ActivePiece): [number, number][] {
  return rotatedCells(piece.type, piece.rot).map(
    ([x, y]) => [piece.x + x, piece.y + y] as [number, number],
  );
}

function isValid(board: number[][], piece: ActivePiece): boolean {
  for (const [x, y] of cellsOf(piece)) {
    if (x < 0 || x >= COLS || y >= ROWS) return false;
    if (y >= 0 && board[y][x] !== 0) return false; // y < 0 allowed above top
  }
  return true;
}

function spawnPiece(type: PieceType): ActivePiece {
  return { type, rot: 0, x: type === "O" ? 4 : 3, y: 0 };
}

function refillBag(seed: number): { bag: PieceType[]; rngSeed: number } {
  const arr = [...ALL_PIECES];
  let s = seed;
  for (let i = arr.length - 1; i > 0; i--) {
    const [next, r] = nextRng(s);
    s = next;
    const j = Math.floor(r * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return { bag: arr, rngSeed: s };
}

function draw(
  bag: PieceType[],
  seed: number,
): { type: PieceType; bag: PieceType[]; rngSeed: number } {
  let b = bag;
  let s = seed;
  if (b.length === 0) {
    const refilled = refillBag(s);
    b = refilled.bag;
    s = refilled.rngSeed;
  }
  const [type, ...rest] = b;
  return { type, bag: rest, rngSeed: s };
}

export function createInitialState(seed: number): TetrisState {
  const board = Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
  const { type, bag, rngSeed } = draw([], seed);
  return {
    board,
    active: spawnPiece(type),
    bag,
    lines: 0,
    gameOver: false,
    rngSeed,
    tickCount: 0,
  };
}

function tryMove(
  state: TetrisState,
  dx: number,
  dy: number,
  drot: number,
): TetrisState | null {
  const a = state.active;
  const candidate: ActivePiece = {
    ...a,
    x: a.x + dx,
    y: a.y + dy,
    rot: (((a.rot + drot) % 4) + 4) % 4,
  };
  return isValid(state.board, candidate) ? { ...state, active: candidate } : null;
}

function lockAndSpawn(state: TetrisState): TetrisState {
  const board = state.board.map((row) => [...row]);
  const colour = PIECE_ID[state.active.type];
  for (const [x, y] of cellsOf(state.active)) {
    if (y >= 0 && y < ROWS && x >= 0 && x < COLS) board[y][x] = colour;
  }

  let cleared = 0;
  const kept = board.filter((row) => {
    const full = row.every((c) => c !== 0);
    if (full) cleared += 1;
    return !full;
  });
  while (kept.length < ROWS) kept.unshift(new Array(COLS).fill(0));

  const { type, bag, rngSeed } = draw(state.bag, state.rngSeed);
  const active = spawnPiece(type);

  return {
    ...state,
    board: kept,
    active,
    bag,
    rngSeed,
    lines: state.lines + cleared,
    gameOver: !isValid(kept, active),
  };
}

export function moveLeft(state: TetrisState): TetrisState {
  if (state.gameOver) return state;
  return tryMove(state, -1, 0, 0) ?? state;
}

export function moveRight(state: TetrisState): TetrisState {
  if (state.gameOver) return state;
  return tryMove(state, 1, 0, 0) ?? state;
}

export function rotate(state: TetrisState): TetrisState {
  if (state.gameOver) return state;
  return tryMove(state, 0, 0, 1) ?? state;
}

/** Gravity step — drop one row, or lock + spawn if it can't fall. */
export function tick(state: TetrisState): TetrisState {
  if (state.gameOver) return state;
  const moved = tryMove(state, 0, 1, 0);
  const next = moved ?? lockAndSpawn(state);
  return { ...next, tickCount: state.tickCount + 1 };
}

export function softDrop(state: TetrisState): TetrisState {
  if (state.gameOver) return state;
  return tryMove(state, 0, 1, 0) ?? lockAndSpawn(state);
}

export function hardDrop(state: TetrisState): TetrisState {
  if (state.gameOver) return state;
  let cur = state;
  let moved = tryMove(cur, 0, 1, 0);
  while (moved) {
    cur = moved;
    moved = tryMove(cur, 0, 1, 0);
  }
  return lockAndSpawn(cur);
}
