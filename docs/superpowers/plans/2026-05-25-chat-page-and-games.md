# Chat page + per-room games library (Snake) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move chat off the room dashboard into its own per-room subpage, and add a per-room games library (`/app/rooms/[id]/games`) with Snake as the first game and per-game leaderboards.

**Architecture:** Use Next 16 App Router route segments — a new `src/app/app/rooms/[id]/layout.tsx` renders the room header + a tab bar (Overzicht / Chat / Eten / Games); each tab is its own server-component page that fetches what it needs. Snake is a `"use client"` canvas component driven by a pure, seeded state machine that is fully unit-testable. Scores live in a new `game_scores` table with RLS via the existing `is_room_member()` helper; the leaderboard refreshes via `revalidatePath` after each submit (no realtime in v1).

**Tech Stack:** Next 16 (App Router, RSC, Server Actions), TypeScript strict, Tailwind v4, shadcn/ui (base-nova / @base-ui/react — uses `render` prop, NOT `asChild`), Supabase Postgres + RLS, Zod, Vitest (unit), Playwright (e2e), pnpm.

**Spec:** `docs/superpowers/specs/2026-05-25-chat-page-and-games-design.md`

**Branch:** `feat/chat-page-and-games` (already created)

---

## File map

**New files:**
- `supabase/migrations/0007_game_scores.sql`
- `src/lib/games/snake/engine.ts` (pure)
- `src/lib/games/queries.ts`
- `src/lib/validation/games.ts`
- `src/app/_actions/games.ts`
- `src/app/app/rooms/[id]/layout.tsx`
- `src/app/app/rooms/[id]/chat/page.tsx`
- `src/app/app/rooms/[id]/games/page.tsx`
- `src/app/app/rooms/[id]/games/snake/page.tsx`
- `src/components/rooms/room-tabs.tsx` (client)
- `src/components/rooms/room-page-header.tsx` (server)
- `src/components/games/game-card.tsx` (server)
- `src/components/games/leaderboard.tsx` (server)
- `src/components/games/snake/snake-game.tsx` (client)
- `tests/unit/snake-engine.test.ts`
- `tests/e2e/rooms-tabs.spec.ts`

**Modified files:**
- `src/types/database.ts` — add `game_scores`
- `src/lib/copy.ts` — `rooms.tabs.{overview,food,games}`, `games.*`
- `src/components/rooms/room-dashboard.tsx` — strip mobile tabs + chat slot + h1
- `src/components/rooms/room-actions.tsx` — drop Eten button
- `src/app/app/rooms/[id]/page.tsx` — drop header (moved to layout), drop chat fetch
- `src/app/app/rooms/[id]/eten/page.tsx` — drop in-page header (moved to layout)

---

## Task 1: Snake engine — pure state machine (TDD)

**Files:**
- Create: `src/lib/games/snake/engine.ts`
- Test: `tests/unit/snake-engine.test.ts`

The engine is pure (no React, no DOM, no global state). All randomness flows through a seeded xorshift32 stored in the state, so tests are deterministic.

- [ ] **Step 1.1: Write the failing test file**

```ts
// tests/unit/snake-engine.test.ts
import { describe, expect, it } from "vitest";

import {
  applyInput,
  createInitialState,
  GRID,
  nextSpeedMs,
  tick,
  type SnakeState,
} from "@/lib/games/snake/engine";

describe("snake engine — initial state", () => {
  it("places one snake cell in the middle and food elsewhere", () => {
    const state = createInitialState(42);
    expect(state.snake).toHaveLength(1);
    expect(state.score).toBe(0);
    expect(state.gameOver).toBe(false);
    expect(state.dir).toBe("right");
    expect(state.pendingDir).toBe("right");
    expect(state.food).not.toEqual(state.snake[0]);
  });

  it("is deterministic for the same seed", () => {
    const a = createInitialState(123);
    const b = createInitialState(123);
    expect(a.food).toEqual(b.food);
    expect(a.rngSeed).toEqual(b.rngSeed);
  });
});

describe("snake engine — tick movement", () => {
  it("moves the head one cell in the current direction", () => {
    const state = createInitialState(42);
    const next = tick(state);
    expect(next.snake[0]?.x).toBe(state.snake[0]!.x + 1);
    expect(next.snake[0]?.y).toBe(state.snake[0]!.y);
    expect(next.tickCount).toBe(1);
  });

  it("keeps snake length 1 when not eating", () => {
    const state = createInitialState(42);
    const next = tick(state);
    // If food happens to be the next cell (rare with seed=42), bail.
    if (next.score === 1) return;
    expect(next.snake).toHaveLength(1);
  });
});

describe("snake engine — eating food", () => {
  it("grows the snake and increases score", () => {
    const state: SnakeState = {
      snake: [{ x: 5, y: 5 }],
      food: { x: 6, y: 5 },
      dir: "right",
      pendingDir: "right",
      score: 0,
      gameOver: false,
      tickCount: 0,
      rngSeed: 1,
    };
    const next = tick(state);
    expect(next.snake[0]).toEqual({ x: 6, y: 5 });
    expect(next.snake).toHaveLength(2);
    expect(next.score).toBe(1);
  });

  it("places new food off the snake after eating", () => {
    const state: SnakeState = {
      snake: [{ x: 5, y: 5 }],
      food: { x: 6, y: 5 },
      dir: "right", pendingDir: "right",
      score: 0, gameOver: false, tickCount: 0, rngSeed: 1,
    };
    const next = tick(state);
    expect(next.snake).not.toContainEqual(next.food);
  });
});

describe("snake engine — collisions", () => {
  it("ends the game when hitting a wall", () => {
    const state: SnakeState = {
      snake: [{ x: GRID - 1, y: 5 }],
      food: { x: 0, y: 0 },
      dir: "right", pendingDir: "right",
      score: 0, gameOver: false, tickCount: 0, rngSeed: 1,
    };
    const next = tick(state);
    expect(next.gameOver).toBe(true);
  });

  it("ends the game when hitting itself", () => {
    const state: SnakeState = {
      snake: [
        { x: 5, y: 5 },
        { x: 4, y: 5 },
        { x: 4, y: 4 },
        { x: 5, y: 4 },
      ],
      food: { x: 0, y: 0 },
      dir: "up", pendingDir: "up",
      score: 0, gameOver: false, tickCount: 0, rngSeed: 1,
    };
    const next = tick(state);
    expect(next.gameOver).toBe(true);
  });

  it("does not move once gameOver is true", () => {
    const dead: SnakeState = {
      snake: [{ x: 5, y: 5 }],
      food: { x: 0, y: 0 },
      dir: "right", pendingDir: "right",
      score: 0, gameOver: true, tickCount: 0, rngSeed: 1,
    };
    expect(tick(dead)).toEqual(dead);
  });
});

describe("snake engine — input", () => {
  it("queues the next direction via pendingDir", () => {
    const state = createInitialState(1); // dir=right
    const turned = applyInput(state, "up");
    expect(turned.pendingDir).toBe("up");
    expect(turned.dir).toBe("right");
    const ticked = tick(turned);
    expect(ticked.dir).toBe("up");
  });

  it("rejects 180-degree turns", () => {
    const state = createInitialState(1); // dir=right
    const blocked = applyInput(state, "left");
    expect(blocked.pendingDir).toBe("right");
  });

  it("ignores input after gameOver", () => {
    const dead: SnakeState = {
      snake: [{ x: 5, y: 5 }],
      food: { x: 0, y: 0 },
      dir: "right", pendingDir: "right",
      score: 0, gameOver: true, tickCount: 0, rngSeed: 1,
    };
    expect(applyInput(dead, "up")).toEqual(dead);
  });
});

describe("snake engine — speed curve", () => {
  it("speeds up as score grows, clamped at 80ms", () => {
    expect(nextSpeedMs(0)).toBe(160);
    expect(nextSpeedMs(5)).toBeLessThan(nextSpeedMs(0));
    expect(nextSpeedMs(1000)).toBe(80);
  });
});
```

- [ ] **Step 1.2: Run the test and confirm it fails**

Run: `pnpm test snake-engine`
Expected: FAIL — `Cannot find module '@/lib/games/snake/engine'`.

- [ ] **Step 1.3: Implement the engine**

Create `src/lib/games/snake/engine.ts`:

```ts
export const GRID = 20;

export type Direction = "up" | "down" | "left" | "right";
export type Cell = { x: number; y: number };

export interface SnakeState {
  snake: Cell[]; // index 0 is the head
  food: Cell;
  dir: Direction;
  pendingDir: Direction; // applied at the next tick
  score: number;
  gameOver: boolean;
  tickCount: number;
  rngSeed: number;
}

// xorshift32 — pure step. Returns [nextSeed, value in [0, 1)].
function nextRng(seed: number): [number, number] {
  let s = seed | 0;
  if (s === 0) s = 1;
  s ^= s << 13;
  s ^= s >>> 17;
  s ^= s << 5;
  // Map to [0, 1)
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
  // Fallback: scan grid for the first free cell. Bounded by GRID*GRID.
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const cell = { x, y };
      if (!isOccupied(cell, occupied)) return { cell, nextSeed: s };
    }
  }
  // Grid full (score = GRID*GRID - 1). Return head; the caller won't render food again anyway.
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
  const body = ate ? state.snake : state.snake.slice(0, -1);
  if (isOccupied(newHead, body)) {
    return { ...state, dir, gameOver: true, tickCount: state.tickCount + 1 };
  }

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

// 160ms at score 0, 4ms faster per apple, floor at 80ms.
export function nextSpeedMs(score: number): number {
  return Math.max(80, 160 - score * 4);
}
```

- [ ] **Step 1.4: Run the tests and confirm they pass**

Run: `pnpm test snake-engine`
Expected: all 12 tests pass.

- [ ] **Step 1.5: Commit**

```bash
git add src/lib/games/snake/engine.ts tests/unit/snake-engine.test.ts
git commit -m "feat(games): pure Snake engine with seeded RNG + tests"
```

---

## Task 2: Validation schema for game scores

**Files:**
- Create: `src/lib/validation/games.ts`
- Test: `tests/unit/games-validation.test.ts`

- [ ] **Step 2.1: Write the failing test**

```ts
// tests/unit/games-validation.test.ts
import { describe, expect, it } from "vitest";

import { submitScoreSchema } from "@/lib/validation/games";

describe("submitScoreSchema", () => {
  const baseInput = {
    roomId: "11111111-1111-1111-1111-111111111111",
    gameKey: "snake" as const,
    score: 10,
  };

  it("accepts a valid input", () => {
    expect(submitScoreSchema.safeParse(baseInput).success).toBe(true);
  });

  it("rejects a non-uuid roomId", () => {
    const result = submitScoreSchema.safeParse({ ...baseInput, roomId: "abc" });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown gameKey", () => {
    const result = submitScoreSchema.safeParse({
      ...baseInput,
      gameKey: "tetris",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a negative score", () => {
    const result = submitScoreSchema.safeParse({ ...baseInput, score: -1 });
    expect(result.success).toBe(false);
  });

  it("rejects a non-integer score", () => {
    const result = submitScoreSchema.safeParse({ ...baseInput, score: 1.5 });
    expect(result.success).toBe(false);
  });

  it("rejects scores above the sanity cap", () => {
    const result = submitScoreSchema.safeParse({
      ...baseInput,
      score: 100_001,
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2.2: Run and confirm failure**

Run: `pnpm test games-validation`
Expected: FAIL — module not found.

- [ ] **Step 2.3: Implement the schema**

```ts
// src/lib/validation/games.ts
import { z } from "zod";

export const GAME_KEYS = ["snake"] as const;
export const gameKeySchema = z.enum(GAME_KEYS);
export type GameKey = z.infer<typeof gameKeySchema>;

export const submitScoreSchema = z.object({
  roomId: z.string().uuid(),
  gameKey: gameKeySchema,
  score: z.number().int().min(0).max(100_000),
});

export type SubmitScoreInput = z.infer<typeof submitScoreSchema>;
```

- [ ] **Step 2.4: Run and confirm pass**

Run: `pnpm test games-validation`
Expected: 6 tests pass.

- [ ] **Step 2.5: Commit**

```bash
git add src/lib/validation/games.ts tests/unit/games-validation.test.ts
git commit -m "feat(games): zod schema for submitGameScore + tests"
```

---

## Task 3: Copy additions

**Files:**
- Modify: `src/lib/copy.ts`

No test — these are literal strings; the type checker catches typos via downstream usage.

- [ ] **Step 3.1: Replace the `rooms.tabs` block**

In `src/lib/copy.ts`, find:

```ts
    tabs: {
      breaks: "Pauzes",
      presence: "Wie is er?",
      chat: "Chat",
    },
    chatPlaceholder: "Chat komt binnenkort beschikbaar.",
```

Replace with:

```ts
    tabs: {
      overview: "Overzicht",
      chat: "Chat",
      food: "Eten",
      games: "Games",
    },
```

Note: drop `chatPlaceholder` — the chat tab now links to its own page; no inline placeholder needed.

- [ ] **Step 3.2: Add the `games` block before the closing `} as const;` line**

After the existing `food: { ... }` block (which ends around line 346 with `slotTaken: "Deze keuze staat al voor die dag.",`), add a new top-level block:

```ts
  games: {
    nav: "Games",
    title: "Spelletjes",
    subtitle: "Speel tegen je medestudenten",
    play: "Speel",
    yourBest: "Jouw beste",
    noBest: "—",
    leaderboard: "Leaderboard",
    noScores: "Nog niemand heeft gespeeld.",
    submitError: "Score kon niet opgeslagen worden.",
    snake: {
      title: "Snake",
      subtitle: "Klassiek — pijltjes of WASD om te draaien",
      score: "Score",
      gameOver: "Game over",
      restart: "Opnieuw",
      newHighScore: "Nieuwe high score!",
      saved: (n: number) => `Score ${n} opgeslagen`,
      mobileBlocked:
        "Snake is enkel speelbaar op desktop — kom terug op een laptop.",
    },
  },
```

Make sure it's added inside the `copy = { ... }` object, before the closing `} as const;`.

- [ ] **Step 3.3: Verify the file still parses**

Run: `pnpm lint`
Expected: no errors mentioning `copy.ts`.

- [ ] **Step 3.4: Commit**

```bash
git add src/lib/copy.ts
git commit -m "feat(copy): tabs + games copy strings (NL)"
```

---

## Task 4: Migration + database types for `game_scores`

**Files:**
- Create: `supabase/migrations/0007_game_scores.sql`
- Modify: `src/types/database.ts`

The SQL migration is run manually in the Supabase SQL Editor (per project convention). The TS types must be added so server code compiles.

- [ ] **Step 4.1: Create the migration**

```sql
-- supabase/migrations/0007_game_scores.sql
-- ============================================================================
-- BibSync — deel 4: per-room games library (Snake first)
-- Single table for all game scores; per-room/per-game high-score leaderboard.
-- Inserts only — keeps the leaderboard query trivial (max(score) per user).
-- ============================================================================

create table if not exists public.game_scores (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references public.rooms(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  game_key   text not null,
  score      integer not null check (score >= 0),
  created_at timestamptz not null default now()
);

create index if not exists game_scores_room_game_score_idx
  on public.game_scores (room_id, game_key, score desc);
create index if not exists game_scores_user_idx
  on public.game_scores (user_id);

alter table public.game_scores enable row level security;

-- Any member of the room can see all scores in that room (leaderboard).
create policy "game_scores_select_member" on public.game_scores
  for select to authenticated
  using (public.is_room_member(room_id) or public.is_admin());

-- A user can only insert a score for themselves in a room they belong to.
create policy "game_scores_insert_self" on public.game_scores
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_room_member(room_id));

-- Admin can delete (cleanup tool).
create policy "game_scores_delete_admin" on public.game_scores
  for delete to authenticated
  using (public.is_admin());

-- Realtime is NOT enabled in v1. revalidatePath after submit is enough.
```

- [ ] **Step 4.2: Add types in `src/types/database.ts`**

Find the `push_subscriptions: { ... }` block inside `Tables`. After its closing `};`, before `};` closing `Tables`, insert:

```ts
      game_scores: {
        Row: {
          id: string;
          room_id: string;
          user_id: string;
          game_key: string;
          score: number;
          created_at: Timestamp;
        };
        Insert: {
          id?: string;
          room_id: string;
          user_id: string;
          game_key: string;
          score: number;
          created_at?: Timestamp;
        };
        Update: {
          id?: string;
          room_id?: string;
          user_id?: string;
          game_key?: string;
          score?: number;
          created_at?: Timestamp;
        };
        Relationships: [];
      };
```

Then, at the bottom (after the existing convenience aliases) add:

```ts
export type GameScore = Database["public"]["Tables"]["game_scores"]["Row"];
```

- [ ] **Step 4.3: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: no errors. (Existing files only reference tables that still exist; the new game_scores row is unused so far.)

- [ ] **Step 4.4: Document the manual migration step**

This is a doc-only nudge for the human running it — no need to add a separate doc file. Verify the migration filename matches the next number after the latest in `supabase/migrations/`:

Run: `ls supabase/migrations/`
Expected: `0001_init.sql ... 0006_avatars.sql 0007_game_scores.sql`.

- [ ] **Step 4.5: Commit**

```bash
git add supabase/migrations/0007_game_scores.sql src/types/database.ts
git commit -m "feat(db): game_scores table + types (run 0007 manually in Supabase SQL Editor)"
```

---

## Task 5: Server-side queries + submit action

**Files:**
- Create: `src/lib/games/queries.ts`
- Create: `src/app/_actions/games.ts`

Not unit-tested in isolation — they call Supabase. Type-checked by `tsc`, behaviour-checked in the manual verification at the end. (This matches the existing pattern in `src/lib/proposals/queries.ts` and `src/app/_actions/proposals.ts`.)

- [ ] **Step 5.1: Create the queries**

```ts
// src/lib/games/queries.ts
import { createClient } from "@/lib/supabase/server";
import { getRoomMembers } from "@/lib/rooms/queries";
import type { GameKey } from "@/lib/validation/games";

export interface LeaderboardEntry {
  userId: string;
  name: string;
  avatarUrl: string | null;
  bestScore: number;
}

/**
 * Top scores per user in a room for a given game, descending. Joins with
 * the existing member list so we don't need a separate profile fetch.
 */
export async function getRoomLeaderboard(
  roomId: string,
  gameKey: GameKey,
  limit = 10,
): Promise<LeaderboardEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("game_scores")
    .select("user_id, score")
    .eq("room_id", roomId)
    .eq("game_key", gameKey);

  if (error) {
    console.error("[getRoomLeaderboard]", error);
    return [];
  }

  // Reduce to best per user.
  const bestByUser = new Map<string, number>();
  for (const row of data ?? []) {
    const current = bestByUser.get(row.user_id) ?? -1;
    if (row.score > current) bestByUser.set(row.user_id, row.score);
  }
  if (bestByUser.size === 0) return [];

  const members = await getRoomMembers(roomId);
  const memberById = new Map(members.map((m) => [m.user_id, m]));

  const entries: LeaderboardEntry[] = [];
  for (const [userId, bestScore] of bestByUser) {
    const member = memberById.get(userId);
    entries.push({
      userId,
      name: member?.profile?.display_name ?? "—",
      avatarUrl: member?.profile?.avatar_url ?? null,
      bestScore,
    });
  }
  entries.sort((a, b) => b.bestScore - a.bestScore);
  return entries.slice(0, limit);
}

/** The caller's best score in this room for this game, or null. */
export async function getMyBestScore(
  roomId: string,
  userId: string,
  gameKey: GameKey,
): Promise<number | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("game_scores")
    .select("score")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .eq("game_key", gameKey)
    .order("score", { ascending: false })
    .limit(1);

  if (error) {
    console.error("[getMyBestScore]", error);
    return null;
  }
  return data?.[0]?.score ?? null;
}
```

- [ ] **Step 5.2: Create the server action**

```ts
// src/app/_actions/games.ts
"use server";

import { revalidatePath } from "next/cache";

import type { ActionResult } from "@/app/_actions/types";
import { copy } from "@/lib/copy";
import { requireRoomAccess } from "@/lib/rooms/queries";
import { createClient } from "@/lib/supabase/server";
import { submitScoreSchema, type SubmitScoreInput } from "@/lib/validation/games";

export async function submitGameScore(
  input: SubmitScoreInput,
): Promise<ActionResult> {
  const parsed = submitScoreSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: copy.games.submitError };
  }

  const access = await requireRoomAccess(parsed.data.roomId);
  if (!access) return { ok: false, error: copy.common.notAuthenticated };

  const supabase = await createClient();
  const { error } = await supabase.from("game_scores").insert({
    room_id: parsed.data.roomId,
    user_id: access.userId,
    game_key: parsed.data.gameKey,
    score: parsed.data.score,
  });

  if (error) {
    console.error("[submitGameScore]", error);
    return { ok: false, error: copy.games.submitError };
  }

  revalidatePath(`/app/rooms/${parsed.data.roomId}/games`);
  revalidatePath(`/app/rooms/${parsed.data.roomId}/games/${parsed.data.gameKey}`);
  return { ok: true };
}
```

- [ ] **Step 5.3: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 5.4: Commit**

```bash
git add src/lib/games/queries.ts src/app/_actions/games.ts
git commit -m "feat(games): leaderboard + my-best queries + submitGameScore action"
```

---

## Task 6: Room layout shell — header + tab bar

Introduces the shared layout that replaces the per-page header. After this task, both the existing pages (`page.tsx`, `eten/page.tsx`) will momentarily render their own header AND the layout's header — Task 7 cleans that up.

**Files:**
- Create: `src/app/app/rooms/[id]/layout.tsx`
- Create: `src/components/rooms/room-page-header.tsx`
- Create: `src/components/rooms/room-tabs.tsx`

- [ ] **Step 6.1: Create `<RoomPageHeader>` (server component)**

```tsx
// src/components/rooms/room-page-header.tsx
import { RoomActions } from "@/components/rooms/room-actions";
import { copy } from "@/lib/copy";

interface RoomPageHeaderProps {
  roomId: string;
  roomName: string;
  roomDescription: string | null;
  joinCode: string;
  isOwner: boolean;
  memberCount: number;
}

export function RoomPageHeader({
  roomId,
  roomName,
  roomDescription,
  joinCode,
  isOwner,
  memberCount,
}: RoomPageHeaderProps) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="truncate text-xl font-bold tracking-tight">
          {roomName}
        </h1>
        {roomDescription && (
          <p className="text-sm text-muted-foreground">{roomDescription}</p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          {copy.rooms.membersCount(memberCount)}
        </p>
      </div>
      <RoomActions roomId={roomId} joinCode={joinCode} isOwner={isOwner} />
    </div>
  );
}
```

- [ ] **Step 6.2: Create `<RoomTabs>` (client component)**

```tsx
// src/components/rooms/room-tabs.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { copy } from "@/lib/copy";
import { cn } from "@/lib/utils";

interface RoomTabsProps {
  roomId: string;
}

interface TabDef {
  href: string;
  label: string;
  matches: (pathname: string) => boolean;
}

export function RoomTabs({ roomId }: RoomTabsProps) {
  const pathname = usePathname();
  const base = `/app/rooms/${roomId}`;

  const tabs: TabDef[] = [
    {
      href: base,
      label: copy.rooms.tabs.overview,
      matches: (p) => p === base,
    },
    {
      href: `${base}/chat`,
      label: copy.rooms.tabs.chat,
      matches: (p) => p === `${base}/chat`,
    },
    {
      href: `${base}/eten`,
      label: copy.rooms.tabs.food,
      matches: (p) => p === `${base}/eten`,
    },
    {
      href: `${base}/games`,
      label: copy.rooms.tabs.games,
      matches: (p) => p.startsWith(`${base}/games`),
    },
  ];

  return (
    <nav
      aria-label="Room secties"
      className="mb-5 -mx-4 overflow-x-auto border-b px-4"
    >
      <ul className="flex gap-1">
        {tabs.map((tab) => {
          const active = tab.matches(pathname);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-10 items-center border-b-2 px-3 text-sm font-medium transition-colors",
                  active
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
```

- [ ] **Step 6.3: Create the room layout**

```tsx
// src/app/app/rooms/[id]/layout.tsx
import { notFound } from "next/navigation";

import { RoomPageHeader } from "@/components/rooms/room-page-header";
import { RoomTabs } from "@/components/rooms/room-tabs";
import { LastRoomTracker } from "@/components/rooms/last-room-tracker";
import { getRoomMembers, requireRoomAccess } from "@/lib/rooms/queries";

interface RoomLayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

export default async function RoomLayout({
  children,
  params,
}: RoomLayoutProps) {
  const { id } = await params;
  const access = await requireRoomAccess(id);
  if (!access) notFound();

  const members = await getRoomMembers(id);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <LastRoomTracker roomId={id} />
      <RoomPageHeader
        roomId={access.room.id}
        roomName={access.room.name}
        roomDescription={access.room.description}
        joinCode={access.room.join_code}
        isOwner={access.isOwner}
        memberCount={members.length}
      />
      <RoomTabs roomId={access.room.id} />
      {children}
    </div>
  );
}
```

Note: `requireRoomAccess` is `cache`-wrapped, so the per-page calls in child pages are free. Same for `getRoomMembers`.

- [ ] **Step 6.4: Verify build still works**

Run: `pnpm build`
Expected: succeeds. The room dashboard now has a double header — that's OK temporarily.

- [ ] **Step 6.5: Commit**

```bash
git add src/app/app/rooms/[id]/layout.tsx src/components/rooms/room-page-header.tsx src/components/rooms/room-tabs.tsx
git commit -m "feat(rooms): shared layout with room header + sub-tabs"
```

---

## Task 7: Trim Overzicht — clean room-dashboard, page.tsx, RoomActions, eten/page.tsx

**Files:**
- Modify: `src/components/rooms/room-dashboard.tsx`
- Modify: `src/app/app/rooms/[id]/page.tsx`
- Modify: `src/components/rooms/room-actions.tsx`
- Modify: `src/app/app/rooms/[id]/eten/page.tsx`

The room dashboard shrinks to "Overzicht only" content (breaks + presence). Chat moves out. Eten button on RoomActions goes away. Both `page.tsx` and `eten/page.tsx` lose their in-page header (the layout has it now).

- [ ] **Step 7.1: Slim `room-dashboard.tsx` to Overzicht content**

Replace the entire file:

```tsx
// src/components/rooms/room-dashboard.tsx
interface RoomDashboardProps {
  breaksSlot: React.ReactNode;
  presenceSlot: React.ReactNode;
}

export function RoomDashboard({
  breaksSlot,
  presenceSlot,
}: RoomDashboardProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <section className="min-w-0">{breaksSlot}</section>
      <aside className="space-y-4">{presenceSlot}</aside>
    </div>
  );
}
```

The mobile Tabs, chat slot, room header, and statusSlot are all gone — header is in the layout, chat is its own page, presence stacks under breaks on mobile.

- [ ] **Step 7.2: Slim `app/rooms/[id]/page.tsx` to fetch what Overzicht needs**

Replace the entire file:

```tsx
// src/app/app/rooms/[id]/page.tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PresenceSidebar } from "@/components/presence/presence-sidebar";
import { ProposalsPanel } from "@/components/proposals/proposals-panel";
import { RoomDashboard } from "@/components/rooms/room-dashboard";
import { copy } from "@/lib/copy";
import type { MemberMap } from "@/lib/members";
import { getRoomPresence } from "@/lib/presence/queries";
import { getRoomComments } from "@/lib/proposals/comments-queries";
import { getRoomProposals } from "@/lib/proposals/queries";
import { getRoomMembers, requireRoomAccess } from "@/lib/rooms/queries";

interface RoomPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: RoomPageProps): Promise<Metadata> {
  const { id } = await params;
  const access = await requireRoomAccess(id);
  return { title: access?.room.name ?? copy.rooms.listTitle };
}

export default async function RoomPage({ params }: RoomPageProps) {
  const { id } = await params;
  const access = await requireRoomAccess(id);
  if (!access) notFound();

  const [members, proposalsData, presenceRows, comments] = await Promise.all([
    getRoomMembers(id),
    getRoomProposals(id),
    getRoomPresence(id),
    getRoomComments(id),
  ]);

  const memberMap: MemberMap = Object.fromEntries(
    members.map((member) => [
      member.user_id,
      {
        name: member.profile?.display_name ?? "—",
        avatarUrl: member.profile?.avatar_url ?? null,
      },
    ]),
  );

  const memberOptions = members.map((member) => ({
    id: member.user_id,
    name: member.profile?.display_name ?? "—",
    avatarUrl: member.profile?.avatar_url ?? null,
  }));

  return (
    <RoomDashboard
      breaksSlot={
        <ProposalsPanel
          roomId={access.room.id}
          userId={access.userId}
          members={memberMap}
          initialProposals={proposalsData.proposals}
          initialVotes={proposalsData.votes}
          initialComments={comments}
        />
      }
      presenceSlot={
        <PresenceSidebar
          roomId={access.room.id}
          userId={access.userId}
          members={memberOptions}
          initialPresence={presenceRows}
        />
      }
    />
  );
}
```

- [ ] **Step 7.3: Drop the Eten button from RoomActions**

In `src/components/rooms/room-actions.tsx`:

Remove the imports `Link` (still used for settings — keep it), `UtensilsCrossed`. So change:

```ts
import { Check, Copy, LogOut, Settings, UtensilsCrossed } from "lucide-react";
```

to:

```ts
import { Check, Copy, LogOut, Settings } from "lucide-react";
```

And delete the entire Eten Button block at the top of the return:

```tsx
      <Button
        render={<Link href={`/app/rooms/${roomId}/eten`} />}
        nativeButton={false}
        variant="outline"
        size="sm"
        className="gap-1.5"
      >
        <UtensilsCrossed className="size-4" />
        {copy.food.nav}
      </Button>
```

Keep `Link` import — it's still used by the Settings render prop.

- [ ] **Step 7.4: Trim `eten/page.tsx`**

In `src/app/app/rooms/[id]/eten/page.tsx`, drop the in-page header (Link back + h1/subtitle). Replace the return body:

Find:

```tsx
  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
      <Link
        href={`/app/rooms/${id}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {access.room.name}
      </Link>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{copy.food.title}</h1>
        <p className="text-sm text-muted-foreground">{copy.food.subtitle}</p>
      </div>
      <FoodPanel
        roomId={id}
        userId={access.userId}
        members={memberMap}
        initialProposals={food.proposals}
        initialVotes={food.votes}
        initialComments={food.comments}
      />
    </div>
  );
```

Replace with:

```tsx
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">
          {copy.food.title}
        </h2>
        <p className="text-sm text-muted-foreground">{copy.food.subtitle}</p>
      </div>
      <FoodPanel
        roomId={id}
        userId={access.userId}
        members={memberMap}
        initialProposals={food.proposals}
        initialVotes={food.votes}
        initialComments={food.comments}
      />
    </div>
  );
```

Also remove the now-unused imports at the top of the file: `Link from "next/link"` and `ArrowLeft from "lucide-react"`.

- [ ] **Step 7.5: Verify build + lint clean**

Run: `pnpm build && pnpm lint`
Expected: both succeed.

- [ ] **Step 7.6: Commit**

```bash
git add src/components/rooms/room-dashboard.tsx src/app/app/rooms/[id]/page.tsx src/components/rooms/room-actions.tsx src/app/app/rooms/[id]/eten/page.tsx
git commit -m "refactor(rooms): move header to layout, drop chat slot + eten button"
```

---

## Task 8: New Chat page

**Files:**
- Create: `src/app/app/rooms/[id]/chat/page.tsx`

- [ ] **Step 8.1: Implement the page**

```tsx
// src/app/app/rooms/[id]/chat/page.tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ChatPanel } from "@/components/chat/chat-panel";
import { copy } from "@/lib/copy";
import type { MemberMap } from "@/lib/members";
import { getRoomMessages } from "@/lib/messages/queries";
import { getRoomMembers, requireRoomAccess } from "@/lib/rooms/queries";

interface ChatPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: ChatPageProps): Promise<Metadata> {
  const { id } = await params;
  const access = await requireRoomAccess(id);
  return {
    title: access ? `${copy.chat.title} · ${access.room.name}` : copy.chat.title,
  };
}

export default async function ChatPage({ params }: ChatPageProps) {
  const { id } = await params;
  const access = await requireRoomAccess(id);
  if (!access) notFound();

  const [members, messagesData] = await Promise.all([
    getRoomMembers(id),
    getRoomMessages(id),
  ]);

  const memberMap: MemberMap = Object.fromEntries(
    members.map((member) => [
      member.user_id,
      {
        name: member.profile?.display_name ?? "—",
        avatarUrl: member.profile?.avatar_url ?? null,
      },
    ]),
  );

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">
          {copy.chat.title}
        </h2>
      </div>
      <ChatPanel
        roomId={access.room.id}
        userId={access.userId}
        members={memberMap}
        initialMessages={messagesData.messages}
        initialHasMore={messagesData.hasMore}
      />
    </div>
  );
}
```

- [ ] **Step 8.2: Build + lint**

Run: `pnpm build && pnpm lint`
Expected: clean.

- [ ] **Step 8.3: Commit**

```bash
git add src/app/app/rooms/[id]/chat/page.tsx
git commit -m "feat(chat): dedicated per-room chat page"
```

---

## Task 9: Games library page + Leaderboard component + GameCard

**Files:**
- Create: `src/components/games/game-card.tsx`
- Create: `src/components/games/leaderboard.tsx`
- Create: `src/app/app/rooms/[id]/games/page.tsx`

- [ ] **Step 9.1: Create `<GameCard>` (server)**

```tsx
// src/components/games/game-card.tsx
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { copy } from "@/lib/copy";

interface GameCardProps {
  href: string;
  title: string;
  subtitle: string;
  emoji: string;
  myBest: number | null;
}

export function GameCard({
  href,
  title,
  subtitle,
  emoji,
  myBest,
}: GameCardProps) {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <span aria-hidden className="text-xl">
            {emoji}
          </span>
          {title}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </CardHeader>
      <CardContent className="mt-auto flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {copy.games.yourBest}:{" "}
          <span className="font-medium text-foreground">
            {myBest ?? copy.games.noBest}
          </span>
        </p>
        <Button
          render={<Link href={href} />}
          nativeButton={false}
          size="sm"
        >
          {copy.games.play}
        </Button>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 9.2: Create `<Leaderboard>` (server)**

```tsx
// src/components/games/leaderboard.tsx
import { UserAvatar } from "@/components/user-avatar";
import { copy } from "@/lib/copy";
import type { LeaderboardEntry } from "@/lib/games/queries";

interface LeaderboardProps {
  title: string;
  entries: LeaderboardEntry[];
}

export function Leaderboard({ title, entries }: LeaderboardProps) {
  return (
    <section className="rounded-lg border">
      <div className="border-b px-4 py-3">
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
      </div>
      {entries.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">
          {copy.games.noScores}
        </p>
      ) : (
        <ol className="divide-y">
          {entries.map((entry, index) => (
            <li
              key={entry.userId}
              className="flex items-center gap-3 px-4 py-2"
            >
              <span className="w-6 text-sm font-mono tabular-nums text-muted-foreground">
                {index + 1}.
              </span>
              <UserAvatar
                name={entry.name}
                avatarUrl={entry.avatarUrl}
                className="size-7"
              />
              <span className="flex-1 truncate text-sm">{entry.name}</span>
              <span className="font-mono tabular-nums text-sm font-semibold">
                {entry.bestScore}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
```

- [ ] **Step 9.3: Create the games index page**

```tsx
// src/app/app/rooms/[id]/games/page.tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { GameCard } from "@/components/games/game-card";
import { Leaderboard } from "@/components/games/leaderboard";
import { copy } from "@/lib/copy";
import { getMyBestScore, getRoomLeaderboard } from "@/lib/games/queries";
import { requireRoomAccess } from "@/lib/rooms/queries";

interface GamesPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: GamesPageProps): Promise<Metadata> {
  const { id } = await params;
  const access = await requireRoomAccess(id);
  return {
    title: access ? `${copy.games.title} · ${access.room.name}` : copy.games.title,
  };
}

export default async function GamesPage({ params }: GamesPageProps) {
  const { id } = await params;
  const access = await requireRoomAccess(id);
  if (!access) notFound();

  const [snakeBest, snakeBoard] = await Promise.all([
    getMyBestScore(id, access.userId, "snake"),
    getRoomLeaderboard(id, "snake"),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">
          {copy.games.title}
        </h2>
        <p className="text-sm text-muted-foreground">{copy.games.subtitle}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <GameCard
          href={`/app/rooms/${id}/games/snake`}
          title={copy.games.snake.title}
          subtitle={copy.games.snake.subtitle}
          emoji="🐍"
          myBest={snakeBest}
        />
      </div>

      <Leaderboard
        title={`${copy.games.leaderboard} — ${copy.games.snake.title}`}
        entries={snakeBoard}
      />
    </div>
  );
}
```

- [ ] **Step 9.4: Build + lint**

Run: `pnpm build && pnpm lint`
Expected: clean.

- [ ] **Step 9.5: Commit**

```bash
git add src/components/games/ src/app/app/rooms/[id]/games/page.tsx
git commit -m "feat(games): library index page with Snake card + leaderboard"
```

---

## Task 10: Snake page + `<SnakeGame>` client component

**Files:**
- Create: `src/components/games/snake/snake-game.tsx`
- Create: `src/app/app/rooms/[id]/games/snake/page.tsx`

- [ ] **Step 10.1: Implement `<SnakeGame>` (client)**

```tsx
// src/components/games/snake/snake-game.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { submitGameScore } from "@/app/_actions/games";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import {
  applyInput,
  createInitialState,
  GRID,
  nextSpeedMs,
  tick,
  type Direction,
  type SnakeState,
} from "@/lib/games/snake/engine";

const CELL_SIZE = 24;
const CANVAS_SIZE = CELL_SIZE * GRID;

interface SnakeGameProps {
  roomId: string;
  myBest: number | null;
}

function makeSeed(): number {
  return (Date.now() ^ Math.floor(Math.random() * 0xffffff)) | 0;
}

const KEY_MAP: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  a: "left",
  s: "down",
  d: "right",
  W: "up",
  A: "left",
  S: "down",
  D: "right",
};

export function SnakeGame({ roomId, myBest }: SnakeGameProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [state, setState] = useState<SnakeState>(() =>
    createInitialState(makeSeed()),
  );
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const submittedRef = useRef(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsMobile(window.matchMedia("(pointer: coarse)").matches);
    }
  }, []);

  // Input
  useEffect(() => {
    if (isMobile) return;
    function onKey(e: KeyboardEvent) {
      const dir = KEY_MAP[e.key];
      if (!dir) return;
      e.preventDefault();
      setState((current) => applyInput(current, dir));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isMobile]);

  // Tick loop — restarts when score changes (so speed steps up)
  useEffect(() => {
    if (isMobile || state.gameOver) return;
    const interval = window.setInterval(() => {
      setState((current) => tick(current));
    }, nextSpeedMs(state.score));
    return () => window.clearInterval(interval);
  }, [isMobile, state.score, state.gameOver]);

  // Submit score once on game-over
  useEffect(() => {
    if (!state.gameOver || submittedRef.current || state.score === 0) return;
    submittedRef.current = true;
    const finalScore = state.score;
    const beatBest = finalScore > (myBest ?? 0);
    void submitGameScore({ roomId, gameKey: "snake", score: finalScore }).then(
      (result) => {
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success(
          beatBest
            ? copy.games.snake.newHighScore
            : copy.games.snake.saved(finalScore),
        );
      },
    );
  }, [state.gameOver, state.score, roomId, myBest]);

  // Render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Background
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Faint grid
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 1;
    for (let i = 1; i < GRID; i++) {
      ctx.beginPath();
      ctx.moveTo(i * CELL_SIZE + 0.5, 0);
      ctx.lineTo(i * CELL_SIZE + 0.5, CANVAS_SIZE);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * CELL_SIZE + 0.5);
      ctx.lineTo(CANVAS_SIZE, i * CELL_SIZE + 0.5);
      ctx.stroke();
    }

    // Food
    ctx.fillStyle = "#ef4444";
    ctx.fillRect(
      state.food.x * CELL_SIZE + 3,
      state.food.y * CELL_SIZE + 3,
      CELL_SIZE - 6,
      CELL_SIZE - 6,
    );

    // Snake
    ctx.fillStyle = "#22c55e";
    for (const cell of state.snake) {
      ctx.fillRect(
        cell.x * CELL_SIZE + 1,
        cell.y * CELL_SIZE + 1,
        CELL_SIZE - 2,
        CELL_SIZE - 2,
      );
    }
  }, [state]);

  const restart = useCallback(() => {
    submittedRef.current = false;
    setState(createInitialState(makeSeed()));
  }, []);

  if (isMobile) {
    return (
      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        {copy.games.snake.mobileBlocked}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm">
          <span className="text-muted-foreground">
            {copy.games.snake.score}:
          </span>{" "}
          <span className="font-mono tabular-nums font-semibold">
            {state.score}
          </span>
        </p>
        <Button size="sm" variant="outline" onClick={restart}>
          {copy.games.snake.restart}
        </Button>
      </div>
      <canvas
        ref={canvasRef}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        className="rounded-lg border"
        tabIndex={0}
        aria-label={copy.games.snake.title}
      />
      {state.gameOver && (
        <p className="text-sm font-medium text-destructive">
          {copy.games.snake.gameOver}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 10.2: Implement the Snake page (server)**

```tsx
// src/app/app/rooms/[id]/games/snake/page.tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Leaderboard } from "@/components/games/leaderboard";
import { SnakeGame } from "@/components/games/snake/snake-game";
import { copy } from "@/lib/copy";
import { getMyBestScore, getRoomLeaderboard } from "@/lib/games/queries";
import { requireRoomAccess } from "@/lib/rooms/queries";

interface SnakePageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: SnakePageProps): Promise<Metadata> {
  const { id } = await params;
  const access = await requireRoomAccess(id);
  return {
    title: access
      ? `${copy.games.snake.title} · ${access.room.name}`
      : copy.games.snake.title,
  };
}

export default async function SnakePage({ params }: SnakePageProps) {
  const { id } = await params;
  const access = await requireRoomAccess(id);
  if (!access) notFound();

  const [myBest, board] = await Promise.all([
    getMyBestScore(id, access.userId, "snake"),
    getRoomLeaderboard(id, "snake"),
  ]);

  return (
    <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            {copy.games.snake.title}
          </h2>
          <p className="text-sm text-muted-foreground">
            {copy.games.snake.subtitle}
          </p>
        </div>
        <SnakeGame roomId={id} myBest={myBest} />
      </section>
      <Leaderboard
        title={`${copy.games.leaderboard} — ${copy.games.snake.title}`}
        entries={board}
      />
    </div>
  );
}
```

- [ ] **Step 10.3: Build + lint**

Run: `pnpm build && pnpm lint`
Expected: clean.

- [ ] **Step 10.4: Commit**

```bash
git add src/components/games/snake/ src/app/app/rooms/[id]/games/snake/page.tsx
git commit -m "feat(games): Snake — canvas client component + page wrapper"
```

---

## Task 11: Playwright auth-gate smoke for new routes

**Files:**
- Create: `tests/e2e/rooms-tabs.spec.ts`

We can only test auth-gating without a seeded test account. That's all we add — matches the existing `tests/e2e/smoke.spec.ts` philosophy.

- [ ] **Step 11.1: Write the spec**

```ts
// tests/e2e/rooms-tabs.spec.ts
import { expect, test } from "@playwright/test";

const dummyId = "11111111-1111-1111-1111-111111111111";

test.describe("new room sub-routes are auth-gated", () => {
  test("/app/rooms/<id>/chat redirects to login", async ({ page }) => {
    await page.goto(`/app/rooms/${dummyId}/chat`);
    await expect(page).toHaveURL(/\/login/);
  });

  test("/app/rooms/<id>/games redirects to login", async ({ page }) => {
    await page.goto(`/app/rooms/${dummyId}/games`);
    await expect(page).toHaveURL(/\/login/);
  });

  test("/app/rooms/<id>/games/snake redirects to login", async ({ page }) => {
    await page.goto(`/app/rooms/${dummyId}/games/snake`);
    await expect(page).toHaveURL(/\/login/);
  });
});
```

- [ ] **Step 11.2: Run the e2e suite**

Run: `pnpm test:e2e`
Expected: all old tests + 3 new ones pass.

- [ ] **Step 11.3: Commit**

```bash
git add tests/e2e/rooms-tabs.spec.ts
git commit -m "test(e2e): auth-gate smoke for chat / games / snake routes"
```

---

## Task 12: Final verification

Per `superpowers:verification-before-completion` — run every check and only declare done when each one is green.

- [ ] **Step 12.1: Vitest unit**

Run: `pnpm test`
Expected: all suites pass, including the 12 snake-engine tests and 6 games-validation tests.

- [ ] **Step 12.2: Playwright e2e**

Run: `pnpm test:e2e`
Expected: pre-existing smoke + 3 new tabs tests pass.

- [ ] **Step 12.3: Build**

Run: `pnpm build`
Expected: clean build, no type or page errors.

- [ ] **Step 12.4: Lint**

Run: `pnpm lint`
Expected: clean.

- [ ] **Step 12.5: Manual verification (user runs this in the browser)**

Instruct the user (or perform via `superpowers:verify` / `vercel:verification`):

1. Run the migration manually in the Supabase SQL Editor:
   - Paste the contents of `supabase/migrations/0007_game_scores.sql`.
   - Confirm the `game_scores` table exists with the 4 policies.
2. `pnpm dev`, log in (e.g. as `beheerder@bibsync.test` from the seed), open any room.
3. Confirm the tab bar shows `Overzicht / Chat / Eten / Games`, with `Overzicht` active.
4. Click `Chat` — `/app/rooms/<id>/chat` loads, the chat history is visible, sending a message works.
5. Click `Eten` — `/app/rooms/<id>/eten` still renders the food panel correctly (no double header).
6. Click `Games` — `/app/rooms/<id>/games` shows the Snake card with "Jouw beste: —" and an empty leaderboard.
7. Click `Speel` (or open the Snake card) — Snake page loads.
8. On desktop: play a game (arrow keys), die, see toast and the score in the leaderboard after navigating back to `/games`.
9. On a phone or narrow viewport with coarse pointer: confirm the `mobileBlocked` message renders instead of the canvas.
10. Confirm the Overzicht page still shows proposals + presence and that the `Eten` button is gone from the action row.

- [ ] **Step 12.6: Note the result and any follow-ups**

If anything is red, file a follow-up note (and don't mark this task done).

If all green, the branch is ready for `superpowers:finishing-a-development-branch` to decide on PR / merge.

---

## Notes / non-goals for this plan

- No realtime updates on the leaderboard. After `submitGameScore` the path is
  revalidated, so a fresh navigation re-renders the server component. If
  this proves too laggy, lift the leaderboard into a client component with
  the existing realtime hook pattern (`use-*-realtime.ts`).
- No anti-cheat. The Zod cap (100k) is a sanity bound; Snake on a 20×20
  grid maxes out at 399.
- No mobile controls for Snake. Out of scope per the spec; show the
  desktop-only copy instead.
- `RoomActions` keeps its Settings + Leave + Copy-Code buttons; only the
  Eten button is removed.
- The spec listed a separate `src/components/games/games-library.tsx`
  wrapper; with only one game (Snake), the grid is rendered inline in
  `games/page.tsx`. Extract it when a second game lands. YAGNI.
