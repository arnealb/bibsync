import { GRID, type Cell, type Direction, type SnakeState } from "@/lib/games/snake/engine";

/**
 * A near-perfect Snake AI.
 *
 * The backbone is a Hamiltonian cycle — a fixed route that visits every cell
 * exactly once and loops. Following it blindly can never kill the snake and
 * eventually fills the whole board (the maximum score), but it's slow. So each
 * tick the bot also looks for a *shortcut*: a neighbouring cell further along
 * the cycle toward the food, taken only when it doesn't overtake the tail,
 * doesn't overshoot the food, and — verified by a flood fill — still leaves the
 * head able to reach its own tail. That keeps it fast early on while staying
 * safe, so it piles up huge scores.
 */

const DELTAS: Record<Direction, Cell> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const OPPOSITE: Record<Direction, Direction> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

const DIRECTIONS: Direction[] = ["up", "down", "left", "right"];

const N = GRID * GRID;
const key = (x: number, y: number) => y * GRID + x;
const inBounds = (x: number, y: number) =>
  x >= 0 && x < GRID && y >= 0 && y < GRID;

/**
 * A Hamiltonian cycle for an even-sized grid: serpentine through columns
 * 1..size-1 and return up column 0. Returns cycle position per cell index.
 */
export function buildCycleIndex(size: number): number[] {
  const order: number[] = new Array(size * size).fill(-1);
  let pos = 0;
  const set = (x: number, y: number) => {
    order[y * size + x] = pos++;
  };
  set(0, 0);
  for (let y = 0; y < size; y++) {
    if (y % 2 === 0) {
      for (let x = 1; x < size; x++) set(x, y);
    } else {
      for (let x = size - 1; x >= 1; x--) set(x, y);
    }
  }
  for (let y = size - 1; y >= 1; y--) set(0, y);
  return order;
}

const CYCLE = buildCycleIndex(GRID);
const cycleIdx = (c: Cell) => CYCLE[key(c.x, c.y)]!;
/** Forward cycle distance from index a to index b. */
const cycleDist = (a: number, b: number) => (b - a + N) % N;

/** Moves the snake one step; returns the new body, or null if it would die. */
function step(snake: Cell[], dir: Direction, food: Cell): Cell[] | null {
  const head = snake[0]!;
  const nx = head.x + DELTAS[dir].x;
  const ny = head.y + DELTAS[dir].y;
  if (!inBounds(nx, ny)) return null;
  const ate = nx === food.x && ny === food.y;
  const body = ate ? snake : snake.slice(0, -1);
  if (body.some((c) => c.x === nx && c.y === ny)) return null;
  return [{ x: nx, y: ny }, ...body];
}

/** Whether the head can still reach the tail through open space. */
function canReachTail(snake: Cell[]): boolean {
  if (snake.length <= 2) return true;
  const head = snake[0]!;
  const tail = snake[snake.length - 1]!;
  const tailKey = key(tail.x, tail.y);
  const blocked = new Set<number>();
  for (let i = 0; i < snake.length - 1; i++) {
    blocked.add(key(snake[i]!.x, snake[i]!.y));
  }
  const visited = new Set<number>([key(head.x, head.y)]);
  let frontier: Cell[] = [head];
  while (frontier.length > 0) {
    const next: Cell[] = [];
    for (const node of frontier) {
      for (const dir of DIRECTIONS) {
        const nx = node.x + DELTAS[dir].x;
        const ny = node.y + DELTAS[dir].y;
        if (!inBounds(nx, ny)) continue;
        const k = key(nx, ny);
        if (k === tailKey) return true;
        if (visited.has(k) || blocked.has(k)) continue;
        visited.add(k);
        next.push({ x: nx, y: ny });
      }
    }
    frontier = next;
  }
  return false;
}

/** Number of free cells reachable from the head (survival heuristic). */
function reachableSpace(snake: Cell[]): number {
  const head = snake[0]!;
  const blocked = new Set<number>();
  for (const c of snake) blocked.add(key(c.x, c.y));
  const visited = new Set<number>([key(head.x, head.y)]);
  let frontier: Cell[] = [head];
  let count = 0;
  while (frontier.length > 0) {
    const next: Cell[] = [];
    for (const node of frontier) {
      for (const dir of DIRECTIONS) {
        const nx = node.x + DELTAS[dir].x;
        const ny = node.y + DELTAS[dir].y;
        if (!inBounds(nx, ny)) continue;
        const k = key(nx, ny);
        if (visited.has(k) || blocked.has(k)) continue;
        visited.add(k);
        count += 1;
        next.push({ x: nx, y: ny });
      }
    }
    frontier = next;
  }
  return count;
}

/** The direction the bot should move this tick. Never reverses into itself. */
export function botDirection(state: SnakeState): Direction {
  const { snake, food, dir } = state;
  const head = snake[0]!;
  const tail = snake[snake.length - 1]!;
  const headIdx = cycleIdx(head);
  const distToTail = snake.length >= N ? 0 : cycleDist(headIdx, cycleIdx(tail));
  const distToFood = cycleDist(headIdx, cycleIdx(food));
  const empties = N - snake.length;

  const candidates = DIRECTIONS.flatMap((d) => {
    if (snake.length > 1 && d === OPPOSITE[dir]) return [];
    const moved = step(snake, d, food);
    if (!moved) return [];
    const adv = cycleDist(headIdx, cycleIdx(moved[0]!));
    return [{ dir: d, moved, adv, reaches: canReachTail(moved) }];
  });
  if (candidates.length === 0) return dir; // unavoidable death

  // 1) Best safe shortcut toward the food (don't overtake tail / overshoot food).
  // Hold back on shortcuts near the end so we don't strand a pocket.
  let shortcut: { dir: Direction; adv: number } | null = null;
  if (empties > 12) {
    for (const c of candidates) {
      if (!c.reaches) continue;
      if (c.adv <= 0 || c.adv >= distToTail || c.adv > distToFood) continue;
      if (!shortcut || c.adv > shortcut.adv) shortcut = { dir: c.dir, adv: c.adv };
    }
  }
  if (shortcut) return shortcut.dir;

  // 2) Otherwise follow the Hamiltonian cycle: smallest forward step that
  //    keeps the tail reachable.
  let follow: { dir: Direction; adv: number } | null = null;
  for (const c of candidates) {
    if (!c.reaches || c.adv <= 0) continue;
    if (!follow || c.adv < follow.adv) follow = { dir: c.dir, adv: c.adv };
  }
  if (follow) return follow.dir;

  // 3) Last resort: stay alive by keeping the most open space.
  let best = candidates[0]!;
  let bestSpace = -1;
  for (const c of candidates) {
    const space = (c.reaches ? 10_000 : 0) + reachableSpace(c.moved);
    if (space > bestSpace) {
      bestSpace = space;
      best = c;
    }
  }
  return best.dir;
}
