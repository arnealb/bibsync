export const GRID = 20;

export type Direction = "up" | "down" | "left" | "right";
export type Cell = { x: number; y: number };

export interface SnakeState {
  snake: Cell[];
  food: Cell;
  dir: Direction;
  pendingDir: Direction;
  score: number;
  gameOver: boolean;
  tickCount: number;
  rngSeed: number;
}

function nextRng(seed: number): [number, number] {
  let s = seed | 0;
  if (s === 0) s = 1;
  s ^= s << 13;
  s ^= s >>> 17;
  s ^= s << 5;
  return [s | 0, ((s >>> 0) % 1_000_000) / 1_000_000];
}

function isOccupied(cell: Cell, occupied: Cell[]): boolean {
  return occupied.some((c) => c.x === cell.x && c.y === cell.y);
}

function randomFreeCell(
  seed: number,
  occupied: Cell[],
): { cell: Cell; nextSeed: number } {
  let s = seed;
  for (let attempt = 0; attempt < 100; attempt++) {
    let r1: number;
    let r2: number;
    [s, r1] = nextRng(s);
    [s, r2] = nextRng(s);
    const cell = { x: Math.floor(r1 * GRID), y: Math.floor(r2 * GRID) };
    if (!isOccupied(cell, occupied)) return { cell, nextSeed: s };
  }
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const cell = { x, y };
      if (!isOccupied(cell, occupied)) return { cell, nextSeed: s };
    }
  }
  return { cell: occupied[0]!, nextSeed: s };
}

export function createInitialState(seed: number): SnakeState {
  const startX = Math.floor(GRID / 2);
  const startY = Math.floor(GRID / 2);
  const snake: Cell[] = [{ x: startX, y: startY }];
  const { cell: food, nextSeed } = randomFreeCell(seed, snake);
  return {
    snake,
    food,
    dir: "right",
    pendingDir: "right",
    score: 0,
    gameOver: false,
    tickCount: 0,
    rngSeed: nextSeed,
  };
}

const OPPOSITE: Record<Direction, Direction> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

export function applyInput(state: SnakeState, dir: Direction): SnakeState {
  if (state.gameOver) return state;
  if (OPPOSITE[state.dir] === dir) return state;
  return { ...state, pendingDir: dir };
}

const DELTAS: Record<Direction, Cell> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export function tick(state: SnakeState): SnakeState {
  if (state.gameOver) return state;
  const dir = state.pendingDir;
  const head = state.snake[0]!;
  const delta = DELTAS[dir];
  const newHead: Cell = { x: head.x + delta.x, y: head.y + delta.y };

  if (
    newHead.x < 0 ||
    newHead.x >= GRID ||
    newHead.y < 0 ||
    newHead.y >= GRID
  ) {
    return { ...state, dir, gameOver: true, tickCount: state.tickCount + 1 };
  }

  const ate = newHead.x === state.food.x && newHead.y === state.food.y;
  if (isOccupied(newHead, state.snake)) {
    return { ...state, dir, gameOver: true, tickCount: state.tickCount + 1 };
  }

  const body = ate ? state.snake : state.snake.slice(0, -1);
  const newSnake: Cell[] = [newHead, ...body];
  let food = state.food;
  let rngSeed = state.rngSeed;
  let score = state.score;
  if (ate) {
    score += 1;
    const placed = randomFreeCell(rngSeed, newSnake);
    food = placed.cell;
    rngSeed = placed.nextSeed;
  }

  return {
    ...state,
    dir,
    snake: newSnake,
    food,
    score,
    rngSeed,
    tickCount: state.tickCount + 1,
  };
}

export function nextSpeedMs(score: number): number {
  return Math.max(80, 160 - score * 4);
}
