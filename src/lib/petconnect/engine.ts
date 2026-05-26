/**
 * Pet Connect (Shisen-Sho style). The board is a grid with a 1-cell empty
 * border, so connecting paths can route around the edge. Two equal tiles match
 * when a path of at most 3 straight segments (≤2 turns) links them through
 * empty cells. Pure + deterministic given an RNG.
 */

export const EMPTY = 0;
export type Grid = number[][]; // 0 = empty; >0 = a pet id. Includes a border.
export interface Point {
  r: number;
  c: number;
}

const DIRS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

function shuffle<T>(items: T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Builds a (rows+2)×(cols+2) bordered grid filled with pairs of pets. */
export function makeBoard(
  rows: number,
  cols: number,
  petCount: number,
  rng: () => number,
): Grid {
  const inner = rows * cols; // must be even
  const ids: number[] = [];
  for (let i = 0; i < inner / 2; i++) {
    const pet = (i % petCount) + 1;
    ids.push(pet, pet);
  }
  const shuffled = shuffle(ids, rng);
  const grid: Grid = Array.from({ length: rows + 2 }, () =>
    Array<number>(cols + 2).fill(EMPTY),
  );
  let k = 0;
  for (let r = 1; r <= rows; r++) {
    for (let c = 1; c <= cols; c++) grid[r]![c] = shuffled[k++]!;
  }
  return grid;
}

/**
 * Returns the connecting path (cells from a to b inclusive) if the two equal
 * tiles can be linked with ≤2 turns, else null.
 */
export function canConnect(grid: Grid, a: Point, b: Point): Point[] | null {
  if (a.r === b.r && a.c === b.c) return null;
  const tile = grid[a.r]?.[a.c];
  if (!tile || tile === EMPTY || grid[b.r]?.[b.c] !== tile) return null;

  const H = grid.length;
  const W = grid[0]!.length;
  const inBounds = (r: number, c: number) => r >= 0 && r < H && c >= 0 && c < W;
  const passable = (r: number, c: number) => grid[r]![c] === EMPTY;
  const isB = (r: number, c: number) => r === b.r && c === b.c;

  interface Node {
    r: number;
    c: number;
    dir: number;
    turns: number;
    path: Point[];
  }
  const start: Point = { r: a.r, c: a.c };
  const queue: Node[] = [];
  const best = new Map<string, number>();

  for (let d = 0; d < 4; d++) {
    const nr = a.r + DIRS[d]![0]!;
    const nc = a.c + DIRS[d]![1]!;
    if (!inBounds(nr, nc)) continue;
    if (isB(nr, nc)) return [start, { r: nr, c: nc }];
    if (!passable(nr, nc)) continue;
    queue.push({ r: nr, c: nc, dir: d, turns: 0, path: [start, { r: nr, c: nc }] });
  }

  while (queue.length > 0) {
    const node = queue.shift()!;
    for (let nd = 0; nd < 4; nd++) {
      const turns = node.turns + (nd === node.dir ? 0 : 1);
      if (turns > 2) continue;
      const nr = node.r + DIRS[nd]![0]!;
      const nc = node.c + DIRS[nd]![1]!;
      if (!inBounds(nr, nc)) continue;
      if (isB(nr, nc)) return [...node.path, { r: nr, c: nc }];
      if (!passable(nr, nc)) continue;
      const key = `${nr},${nc},${nd}`;
      if ((best.get(key) ?? 99) <= turns) continue;
      best.set(key, turns);
      queue.push({
        r: nr,
        c: nc,
        dir: nd,
        turns,
        path: [...node.path, { r: nr, c: nc }],
      });
    }
  }
  return null;
}

/** Tiles still on the board. */
export function tilesLeft(grid: Grid): number {
  return grid.flat().filter((v) => v !== EMPTY).length;
}

export function isCleared(grid: Grid): boolean {
  return tilesLeft(grid) === 0;
}

/** Whether any matching, connectable pair remains. */
export function hasAnyMove(grid: Grid): boolean {
  const cells: Point[] = [];
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[0]!.length; c++) {
      if (grid[r]![c] !== EMPTY) cells.push({ r, c });
    }
  }
  for (let i = 0; i < cells.length; i++) {
    for (let j = i + 1; j < cells.length; j++) {
      if (canConnect(grid, cells[i]!, cells[j]!)) return true;
    }
  }
  return false;
}

/** Returns a copy with `a` and `b` cleared. */
export function removePair(grid: Grid, a: Point, b: Point): Grid {
  const next = grid.map((row) => [...row]);
  next[a.r]![a.c] = EMPTY;
  next[b.r]![b.c] = EMPTY;
  return next;
}

/** Reshuffles the remaining tiles into their occupied positions (for deadlocks). */
export function shuffleRemaining(grid: Grid, rng: () => number): Grid {
  const positions: Point[] = [];
  const values: number[] = [];
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[0]!.length; c++) {
      if (grid[r]![c] !== EMPTY) {
        positions.push({ r, c });
        values.push(grid[r]![c]!);
      }
    }
  }
  const shuffled = shuffle(values, rng);
  const next = grid.map((row) => [...row]);
  positions.forEach((p, i) => {
    next[p.r]![p.c] = shuffled[i]!;
  });
  return next;
}
