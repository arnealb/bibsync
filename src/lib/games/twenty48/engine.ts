export const SIZE = 4;

export type Direction = "up" | "down" | "left" | "right";

export interface Game2048State {
  grid: number[][]; // SIZE x SIZE, 0 = empty
  highestTile: number;
  gameOver: boolean;
  rngSeed: number;
  moves: number;
}

function nextRng(seed: number): [number, number] {
  let s = seed | 0;
  if (s === 0) s = 1;
  s ^= s << 13;
  s ^= s >>> 17;
  s ^= s << 5;
  return [s | 0, ((s >>> 0) % 1_000_000) / 1_000_000];
}

/** Slide one row to the left, merging equal neighbours once. */
export function slideRowLeft(row: number[]): number[] {
  const nums = row.filter((n) => n !== 0);
  const out: number[] = [];
  for (let i = 0; i < nums.length; i++) {
    if (i + 1 < nums.length && nums[i] === nums[i + 1]) {
      out.push(nums[i] * 2);
      i += 1;
    } else {
      out.push(nums[i]);
    }
  }
  while (out.length < row.length) out.push(0);
  return out;
}

function transpose(grid: number[][]): number[][] {
  return grid[0].map((_, c) => grid.map((row) => row[c]));
}

function slideGrid(grid: number[][], dir: Direction): number[][] {
  if (dir === "left") return grid.map(slideRowLeft);
  if (dir === "right") {
    return grid.map((row) => slideRowLeft([...row].reverse()).reverse());
  }
  if (dir === "up") return transpose(slideGrid(transpose(grid), "left"));
  return transpose(slideGrid(transpose(grid), "right")); // down
}

function gridsEqual(a: number[][], b: number[][]): boolean {
  return a.every((row, r) => row.every((v, c) => v === b[r][c]));
}

function emptyCells(grid: number[][]): [number, number][] {
  const cells: [number, number][] = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (grid[r][c] === 0) cells.push([r, c]);
    }
  }
  return cells;
}

function spawnTile(
  grid: number[][],
  seed: number,
): { grid: number[][]; rngSeed: number } {
  const cells = emptyCells(grid);
  if (cells.length === 0) return { grid, rngSeed: seed };
  const [s1, rPos] = nextRng(seed);
  const [s2, rVal] = nextRng(s1);
  const [r, c] = cells[Math.floor(rPos * cells.length)];
  const next = grid.map((row) => [...row]);
  next[r][c] = rVal < 0.9 ? 2 : 4;
  return { grid: next, rngSeed: s2 };
}

function highestOf(grid: number[][]): number {
  return Math.max(...grid.flat());
}

/** Can the board still move? True if any empty cell or any mergeable pair. */
export function canMove(grid: number[][]): boolean {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (grid[r][c] === 0) return true;
      if (c + 1 < SIZE && grid[r][c] === grid[r][c + 1]) return true;
      if (r + 1 < SIZE && grid[r][c] === grid[r + 1][c]) return true;
    }
  }
  return false;
}

export function createInitialState(seed: number): Game2048State {
  let grid = Array.from({ length: SIZE }, () => new Array(SIZE).fill(0));
  let rngSeed = seed;
  ({ grid, rngSeed } = spawnTile(grid, rngSeed));
  ({ grid, rngSeed } = spawnTile(grid, rngSeed));
  return {
    grid,
    highestTile: highestOf(grid),
    gameOver: false,
    rngSeed,
    moves: 0,
  };
}

export function move(state: Game2048State, dir: Direction): Game2048State {
  if (state.gameOver) return state;
  const slid = slideGrid(state.grid, dir);
  if (gridsEqual(slid, state.grid)) return state; // illegal move, no spawn

  const { grid, rngSeed } = spawnTile(slid, state.rngSeed);
  return {
    ...state,
    grid,
    highestTile: highestOf(grid),
    rngSeed,
    moves: state.moves + 1,
    gameOver: !canMove(grid),
  };
}
