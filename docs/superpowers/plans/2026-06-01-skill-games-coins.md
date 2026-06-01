# Skill Games That Pay Bibcoins — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Snake pay 1 coin per apple every run (no cap) and add three more skill games — Flappy Bird (1 coin/pipe), Tetris (1 coin/line) and 2048 (1 coin per new-highest-tile) — that all earn bibcoins through play.

**Architecture:** Each game is a pure, seeded, unit-tested engine in `src/lib/games/<game>/engine.ts` plus a thin `"use client"` canvas/grid component that runs the loop and submits a score once on game-over. The existing `submitGameScore` server action stores the score in `game_scores` and awards `coins` via a new `earnFromArcade`, keyed on a per-run UUID so replays pay again (no cap) but retries don't double-pay. **No database migrations** — `game_scores.game_key` is plain `text` and the bibcoin ledger is generic.

**Tech Stack:** Next.js 16 (App Router, RSC + Server Actions), React 19, TypeScript strict, Zod, Vitest, Supabase (existing `game_scores` table + `award_bibcoins` RPC), Tailwind + base-nova shadcn.

**Conventions to respect (from CLAUDE.md):**
- Dutch user-facing strings live in `src/lib/copy.ts`; code/comments in English. No hardcoded UI strings.
- Server actions return `ActionResult`; Zod-validate server-side.
- Engines are pure and deterministic via a seed; only the client component touches the DOM/canvas.
- `getInitials`/client-safe imports only in client components; never import the server Supabase client into a `"use client"` file.
- Run `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm test` — local `pnpm build` may fail on `next/font` (sandbox), so do not gate on it.

**Commit after every task.** Work happens on branch `feat/skill-games-coins` (already created).

---

## File Structure

**Shared plumbing**
- Modify `src/lib/validation/games.ts` — add game keys `flappy`/`tetris`/`2048`, add `runId` to `submitScoreSchema`.
- Modify `src/lib/bibcoins/config.ts` — add `REWARD.arcadePerEvent`.
- Create `src/lib/games/arcade-coins.ts` — pure `arcadeCoins(gameKey, score)` coin math.
- Modify `src/lib/bibcoins/earn.ts` — replace `earnFromSnake` with generic `earnFromArcade`.
- Modify `src/app/_actions/games.ts` — route every non-petconnect key through `earnFromArcade`; accept `runId`.
- Modify `src/components/games/snake/snake-game.tsx` — send a per-run `runId`.
- Modify `src/components/petconnect/petconnect-board.tsx` — send a `runId` (schema now requires it).

**Flappy Bird**
- Create `src/lib/games/flappy/engine.ts`, `tests/unit/flappy-engine.test.ts`
- Create `src/components/games/flappy/flappy-game.tsx`
- Create `src/app/app/rooms/[id]/games/flappy/page.tsx`

**Tetris**
- Create `src/lib/games/tetris/engine.ts`, `tests/unit/tetris-engine.test.ts`
- Create `src/components/games/tetris/tetris-game.tsx`
- Create `src/app/app/rooms/[id]/games/tetris/page.tsx`

**2048** (route folder + gameKey are the string `2048`; code dirs are `twenty48`; copy key is `twenty48`)
- Create `src/lib/games/twenty48/engine.ts`, `tests/unit/twenty48-engine.test.ts`
- Create `src/components/games/twenty48/twenty48-game.tsx`
- Create `src/app/app/rooms/[id]/games/2048/page.tsx`

**Shared UI**
- Modify `src/app/app/rooms/[id]/games/page.tsx` — three new `GameCard`s.
- Modify `src/lib/copy.ts` — Dutch copy blocks `copy.games.{flappy,tetris,twenty48}`.
- Modify `tests/unit/games-validation.test.ts` — fix the `tetris`-is-unknown assumption, cover new keys + `runId`.
- Modify `tests/unit/game-sessions.test.ts` only if it references removed exports (it does not — verified).

---

## Task 1: Validation & config

**Files:**
- Modify: `src/lib/validation/games.ts`
- Modify: `src/lib/bibcoins/config.ts`
- Test: `tests/unit/games-validation.test.ts`

- [ ] **Step 1: Update the validation test (RED)**

Replace the whole body of `tests/unit/games-validation.test.ts` with:

```ts
import { describe, expect, it } from "vitest";

import { submitScoreSchema } from "@/lib/validation/games";

describe("submitScoreSchema", () => {
  const baseInput = {
    roomId: "11111111-1111-1111-8111-111111111111",
    gameKey: "snake" as const,
    score: 10,
    runId: "22222222-2222-4222-8222-222222222222",
  };

  it("accepts a valid input", () => {
    expect(submitScoreSchema.safeParse(baseInput).success).toBe(true);
  });

  it("accepts the new skill-game keys", () => {
    for (const gameKey of ["flappy", "tetris", "2048"] as const) {
      expect(
        submitScoreSchema.safeParse({ ...baseInput, gameKey }).success,
      ).toBe(true);
    }
  });

  it("rejects a non-uuid roomId", () => {
    const result = submitScoreSchema.safeParse({ ...baseInput, roomId: "abc" });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown gameKey", () => {
    const result = submitScoreSchema.safeParse({
      ...baseInput,
      gameKey: "pacman",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing runId", () => {
    const { runId: _omit, ...withoutRun } = baseInput;
    expect(submitScoreSchema.safeParse(withoutRun).success).toBe(false);
  });

  it("rejects a non-uuid runId", () => {
    const result = submitScoreSchema.safeParse({ ...baseInput, runId: "nope" });
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

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run tests/unit/games-validation.test.ts`
Expected: FAIL — new keys rejected and `runId` not part of the schema yet.

- [ ] **Step 3: Update `src/lib/validation/games.ts`**

Replace the file with:

```ts
import { z } from "zod";

export const GAME_KEYS = [
  "snake",
  "petconnect",
  "flappy",
  "tetris",
  "2048",
] as const;
export const gameKeySchema = z.enum(GAME_KEYS);
export type GameKey = z.infer<typeof gameKeySchema>;

export const submitScoreSchema = z.object({
  roomId: z.string().uuid(),
  gameKey: gameKeySchema,
  score: z.number().int().min(0).max(100_000),
  /** Unique per played run — the idempotency key for the coin payout. */
  runId: z.string().uuid(),
  cheated: z.boolean().optional(),
});

export type SubmitScoreInput = z.infer<typeof submitScoreSchema>;
```

- [ ] **Step 4: Add the config knob**

In `src/lib/bibcoins/config.ts`, inside the `REWARD` object, replace the `snakeBestPerPoint` line:

```ts
  /** Per +1 of a new honest Snake personal best. */
  snakeBestPerPoint: 1,
```

with:

```ts
  /** Coins per coin-event in a skill game (apple / pipe / line / 2048 tile). */
  arcadePerEvent: 1,
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm exec vitest run tests/unit/games-validation.test.ts`
Expected: PASS (all assertions).

- [ ] **Step 6: Commit**

```bash
git add src/lib/validation/games.ts src/lib/bibcoins/config.ts tests/unit/games-validation.test.ts
git commit -m "feat(games): validate new skill-game keys + per-run runId"
```

---

## Task 2: Pure coin math

**Files:**
- Create: `src/lib/games/arcade-coins.ts`
- Test: `tests/unit/arcade-coins.test.ts`

- [ ] **Step 1: Write the failing test (RED)**

Create `tests/unit/arcade-coins.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { arcadeCoins } from "@/lib/games/arcade-coins";

describe("arcadeCoins", () => {
  it("pays one coin per event for snake/flappy/tetris", () => {
    expect(arcadeCoins("snake", 17)).toBe(17);
    expect(arcadeCoins("flappy", 4)).toBe(4);
    expect(arcadeCoins("tetris", 9)).toBe(9);
  });

  it("pays per new-highest-tile milestone for 2048", () => {
    expect(arcadeCoins("2048", 2)).toBe(0); // start tile, no milestone
    expect(arcadeCoins("2048", 4)).toBe(1);
    expect(arcadeCoins("2048", 8)).toBe(2);
    expect(arcadeCoins("2048", 256)).toBe(7);
    expect(arcadeCoins("2048", 2048)).toBe(10);
  });

  it("never pays for a zero or negative score", () => {
    expect(arcadeCoins("snake", 0)).toBe(0);
    expect(arcadeCoins("flappy", -3)).toBe(0);
    expect(arcadeCoins("2048", 0)).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run tests/unit/arcade-coins.test.ts`
Expected: FAIL — `arcadeCoins` does not exist.

- [ ] **Step 3: Write the implementation**

Create `src/lib/games/arcade-coins.ts`:

```ts
import type { GameKey } from "@/lib/validation/games";

/**
 * Coins earned for one finished skill-game run, from its submitted score.
 *
 * snake / flappy / tetris: 1 coin per event (apples / pipes / lines), so
 * coins == score. 2048's score is the highest tile reached (a power of two);
 * it pays 1 coin per new milestone tile from 4 up to that tile, i.e.
 * log2(tile) - 1 (256 = 2^8 -> 7). Math.round keeps it integer-safe.
 */
export function arcadeCoins(gameKey: GameKey, score: number): number {
  if (score <= 0) return 0;
  if (gameKey === "2048") {
    return Math.max(0, Math.round(Math.log2(score)) - 1);
  }
  return score;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run tests/unit/arcade-coins.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/games/arcade-coins.ts tests/unit/arcade-coins.test.ts
git commit -m "feat(games): pure coin math for skill games"
```

---

## Task 3: earnFromArcade + wire submit + Snake fix

This is the Snake "fix": Snake's coin payout changes from best-only to 1 coin/apple every run, and the same path serves all skill games. No new test file — covered by Task 2's math + the existing `tsc`/`lint` gate; behaviour is exercised manually in Task 10.

**Files:**
- Modify: `src/lib/bibcoins/earn.ts`
- Modify: `src/app/_actions/games.ts`
- Modify: `src/components/games/snake/snake-game.tsx`
- Modify: `src/components/petconnect/petconnect-board.tsx`

- [ ] **Step 1: Replace `earnFromSnake` with `earnFromArcade` in `src/lib/bibcoins/earn.ts`**

At the top of the file, update the imports:

```ts
import { awardBibcoins } from "@/lib/bibcoins/award";
import {
  DAILY_CHAT_THRESHOLD,
  REWARD,
  STEPS_REWARD_DAILY_CAP_THOUSANDS,
} from "@/lib/bibcoins/config";
import { unlockAchievement } from "@/lib/bibcoins/unlock";
import { arcadeCoins } from "@/lib/games/arcade-coins";
import { dayTotal } from "@/lib/steps/aggregate";
import { createAdminClient } from "@/lib/supabase/admin";
import { todayInBrussels } from "@/lib/time";
import type { GameKey } from "@/lib/validation/games";
```

Then delete the entire `earnFromSnake` function (the block starting at the
`/** Honest Snake runs pay out up to your all-time best ... */` comment through
its closing brace) and replace it with:

```ts
/**
 * A finished skill-game run pays 1 coin per coin-event (apples / pipes / lines,
 * or 2048 tile milestones). Keyed on the per-run `runId`, so a network retry of
 * the same run pays once, but a fresh run pays again — no cap, by design.
 * Cheated (autopilot) runs earn nothing. Snake score milestones still unlock
 * the snake achievements.
 */
export async function earnFromArcade(
  userId: string,
  gameKey: GameKey,
  score: number,
  runId: string,
  cheated: boolean,
): Promise<void> {
  if (cheated || score <= 0) return;

  const coins = arcadeCoins(gameKey, score) * REWARD.arcadePerEvent;
  if (coins > 0) {
    await awardBibcoins(userId, coins, `${gameKey}_play`, runId);
  }

  if (gameKey === "snake") {
    if (score >= 25) await unlockAchievement(userId, "snake_25");
    if (score >= 100) await unlockAchievement(userId, "snake_100");
  }
}
```

- [ ] **Step 2: Route the action through `earnFromArcade` in `src/app/_actions/games.ts`**

Change the import line:

```ts
import { earnFromPetConnect, earnFromSnake } from "@/lib/bibcoins/earn";
```

to:

```ts
import { earnFromArcade, earnFromPetConnect } from "@/lib/bibcoins/earn";
```

Then replace this block:

```ts
  if (parsed.data.gameKey === "snake") {
    await earnFromSnake(
      access.userId,
      parsed.data.score,
      parsed.data.cheated ?? false,
    );
  } else if (parsed.data.gameKey === "petconnect") {
    await earnFromPetConnect(access.userId);
  }
```

with:

```ts
  if (parsed.data.gameKey === "petconnect") {
    await earnFromPetConnect(access.userId);
  } else {
    await earnFromArcade(
      access.userId,
      parsed.data.gameKey,
      parsed.data.score,
      parsed.data.runId,
      parsed.data.cheated ?? false,
    );
  }
```

- [ ] **Step 3: Send a `runId` from Snake**

In `src/components/games/snake/snake-game.tsx`, add a run-id ref next to the
existing refs (after `const cheatedRef = useRef(false);`):

```ts
  const runIdRef = useRef<string>(crypto.randomUUID());
```

In the submit effect, change the call:

```ts
    void submitGameScore({
      roomId,
      gameKey: "snake",
      score: finalScore,
      cheated: cheatedRef.current,
    }).then(
```

to:

```ts
    void submitGameScore({
      roomId,
      gameKey: "snake",
      score: finalScore,
      cheated: cheatedRef.current,
      runId: runIdRef.current,
    }).then(
```

In `restart`, mint a fresh run id (so the next run pays again). Change:

```ts
  const restart = useCallback(() => {
    submittedRef.current = false;
    cheatedRef.current = false;
    setState(createInitialState(makeSeed()));
  }, []);
```

to:

```ts
  const restart = useCallback(() => {
    submittedRef.current = false;
    cheatedRef.current = false;
    runIdRef.current = crypto.randomUUID();
    setState(createInitialState(makeSeed()));
  }, []);
```

- [ ] **Step 4: Send a `runId` from Pet Connect (schema now requires it)**

In `src/components/petconnect/petconnect-board.tsx`, change:

```ts
      await submitGameScore({ roomId, gameKey: "petconnect", score });
```

to:

```ts
      await submitGameScore({
        roomId,
        gameKey: "petconnect",
        score,
        runId: crypto.randomUUID(),
      });
```

- [ ] **Step 5: Type-check, lint and run the whole suite**

Run: `pnpm exec tsc --noEmit && pnpm lint && pnpm test`
Expected: PASS — no references to the removed `earnFromSnake` remain, all tests green.

- [ ] **Step 6: Commit**

```bash
git add src/lib/bibcoins/earn.ts src/app/_actions/games.ts src/components/games/snake/snake-game.tsx src/components/petconnect/petconnect-board.tsx
git commit -m "feat(games): Snake pays 1 coin/apple every run via earnFromArcade"
```

---

## Task 4: Flappy Bird engine

**Files:**
- Create: `src/lib/games/flappy/engine.ts`
- Test: `tests/unit/flappy-engine.test.ts`

- [ ] **Step 1: Write the failing test (RED)**

Create `tests/unit/flappy-engine.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  HEIGHT,
  createInitialState,
  flap,
  tick,
  type FlappyState,
} from "@/lib/games/flappy/engine";

describe("flappy engine — initial state", () => {
  it("centres the bird with one pipe ahead", () => {
    const s = createInitialState(42);
    expect(s.birdY).toBe(HEIGHT / 2);
    expect(s.vel).toBe(0);
    expect(s.score).toBe(0);
    expect(s.gameOver).toBe(false);
    expect(s.pipes).toHaveLength(1);
  });

  it("is deterministic for the same seed", () => {
    expect(createInitialState(7).pipes[0]).toEqual(
      createInitialState(7).pipes[0],
    );
  });
});

describe("flappy engine — physics", () => {
  it("gravity pulls the bird down over a tick", () => {
    const s = createInitialState(42);
    const next = tick(s);
    expect(next.vel).toBeGreaterThan(0);
    expect(next.birdY).toBeGreaterThan(s.birdY);
    expect(next.tickCount).toBe(1);
  });

  it("flap sets an upward velocity", () => {
    const s = createInitialState(42);
    expect(flap(s).vel).toBeLessThan(0);
  });

  it("ends the game when the bird hits the floor", () => {
    let s: FlappyState = { ...createInitialState(42), birdY: HEIGHT - 1, vel: 5 };
    s = tick(s);
    expect(s.gameOver).toBe(true);
  });

  it("does not advance once gameOver is true", () => {
    const dead: FlappyState = { ...createInitialState(42), gameOver: true };
    expect(tick(dead)).toEqual(dead);
    expect(flap(dead)).toEqual(dead);
  });
});

describe("flappy engine — scoring", () => {
  it("scores when a pipe clears the bird", () => {
    const base = createInitialState(42);
    const s: FlappyState = {
      ...base,
      pipes: [{ x: 10, gapY: 100, passed: false }],
      birdY: 150, // inside the gap [100, 240] so no collision
    };
    const next = tick(s);
    expect(next.score).toBe(1);
    expect(next.pipes[0]?.passed).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run tests/unit/flappy-engine.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the engine**

Create `src/lib/games/flappy/engine.ts`:

```ts
export const WIDTH = 320;
export const HEIGHT = 480;
export const BIRD_X = 70;
export const BIRD_RADIUS = 12;
export const PIPE_WIDTH = 52;
export const PIPE_GAP = 140;

const GRAVITY = 0.4;
const FLAP_VELOCITY = -6.5;
const MAX_FALL = 9;
const PIPE_SPEED = 2;
const PIPE_SPACING = 170;
const GAP_MARGIN = 60;
const GAP_RANGE = HEIGHT - 2 * GAP_MARGIN - PIPE_GAP; // vertical room for the gap top

export interface Pipe {
  x: number;
  gapY: number;
  passed: boolean;
}

export interface FlappyState {
  birdY: number;
  vel: number;
  pipes: Pipe[];
  score: number;
  gameOver: boolean;
  tickCount: number;
  rngSeed: number;
}

/** xorshift32 — returns [nextSeed, float in [0, 1)] (same shape as snake). */
function nextRng(seed: number): [number, number] {
  let s = seed | 0;
  if (s === 0) s = 1;
  s ^= s << 13;
  s ^= s >>> 17;
  s ^= s << 5;
  return [s | 0, ((s >>> 0) % 1_000_000) / 1_000_000];
}

function gapFrom(r: number): number {
  return GAP_MARGIN + Math.floor(r * (GAP_RANGE + 1));
}

export function createInitialState(seed: number): FlappyState {
  const [rngSeed, r] = nextRng(seed);
  return {
    birdY: HEIGHT / 2,
    vel: 0,
    pipes: [{ x: WIDTH, gapY: gapFrom(r), passed: false }],
    score: 0,
    gameOver: false,
    tickCount: 0,
    rngSeed,
  };
}

export function flap(state: FlappyState): FlappyState {
  if (state.gameOver) return state;
  return { ...state, vel: FLAP_VELOCITY };
}

export function tick(state: FlappyState): FlappyState {
  if (state.gameOver) return state;

  const vel = Math.min(state.vel + GRAVITY, MAX_FALL);
  const birdY = state.birdY + vel;
  let rngSeed = state.rngSeed;
  let score = state.score;

  // Move pipes left.
  let pipes = state.pipes.map((p) => ({ ...p, x: p.x - PIPE_SPEED }));

  // Score a pipe once its trailing edge passes the bird.
  pipes = pipes.map((p) => {
    if (!p.passed && p.x + PIPE_WIDTH < BIRD_X - BIRD_RADIUS) {
      score += 1;
      return { ...p, passed: true };
    }
    return p;
  });

  // Drop pipes that scrolled off the left edge.
  pipes = pipes.filter((p) => p.x + PIPE_WIDTH > 0);

  // Spawn the next pipe once the rightmost has advanced one spacing.
  const rightmost = pipes.reduce((max, p) => Math.max(max, p.x), -Infinity);
  if (rightmost <= WIDTH - PIPE_SPACING) {
    const [next, r] = nextRng(rngSeed);
    rngSeed = next;
    pipes = [...pipes, { x: WIDTH, gapY: gapFrom(r), passed: false }];
  }

  // Collisions: floor/ceiling, then each overlapping pipe's solid parts.
  let gameOver = birdY - BIRD_RADIUS < 0 || birdY + BIRD_RADIUS > HEIGHT;
  for (const p of pipes) {
    const overlapsX =
      BIRD_X + BIRD_RADIUS > p.x && BIRD_X - BIRD_RADIUS < p.x + PIPE_WIDTH;
    const insideGap =
      birdY - BIRD_RADIUS > p.gapY && birdY + BIRD_RADIUS < p.gapY + PIPE_GAP;
    if (overlapsX && !insideGap) gameOver = true;
  }

  return {
    ...state,
    birdY,
    vel,
    pipes,
    score,
    gameOver,
    tickCount: state.tickCount + 1,
    rngSeed,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run tests/unit/flappy-engine.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/games/flappy/engine.ts tests/unit/flappy-engine.test.ts
git commit -m "feat(flappy): seeded, unit-tested engine"
```

---

## Task 5: Flappy Bird UI (client + page + card + copy)

**Files:**
- Create: `src/components/games/flappy/flappy-game.tsx`
- Create: `src/app/app/rooms/[id]/games/flappy/page.tsx`
- Modify: `src/lib/copy.ts`
- Modify: `src/app/app/rooms/[id]/games/page.tsx`

- [ ] **Step 1: Add the Dutch copy**

In `src/lib/copy.ts`, inside the `games:` object, immediately after the `snake: { ... },` block, insert:

```ts
    flappy: {
      title: "Flappy Bird",
      subtitle: "Tik om te fladderen — 1 coin per buis",
      score: "Score",
      controls: "Tik, klik of spatie om te fladderen",
      gameOver: "Game over",
      restart: "Opnieuw",
      newHighScore: "Nieuwe high score!",
      saved: (n: number) => `Score ${n} opgeslagen`,
    },
    tetris: {
      title: "Tetris",
      subtitle: "Maak rijen vol — 1 coin per rij",
      score: "Rijen",
      controls: "Pijltjes om te bewegen, ↑ draaien, spatie laten vallen",
      gameOver: "Game over",
      restart: "Opnieuw",
      newHighScore: "Nieuwe high score!",
      saved: (n: number) => `${n} rijen opgeslagen`,
      left: "Links",
      right: "Rechts",
      rotate: "Draai",
      drop: "Laten vallen",
    },
    twenty48: {
      title: "2048",
      subtitle: "Veeg en combineer — 1 coin per nieuwe tegel",
      score: "Hoogste tegel",
      controls: "Pijltjes of vegen om te schuiven",
      gameOver: "Geen zetten meer",
      restart: "Opnieuw",
      newHighScore: "Nieuwe high score!",
      saved: (n: number) => `Tegel ${n} bereikt`,
    },
```

- [ ] **Step 2: Write the Flappy client component**

Create `src/components/games/flappy/flappy-game.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { submitGameScore } from "@/app/_actions/games";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import {
  BIRD_RADIUS,
  BIRD_X,
  HEIGHT,
  PIPE_GAP,
  PIPE_WIDTH,
  WIDTH,
  createInitialState,
  flap,
  tick,
  type FlappyState,
} from "@/lib/games/flappy/engine";

const TICK_MS = 24;

function makeSeed(): number {
  return (Date.now() ^ Math.floor(Math.random() * 0xffffff)) | 0;
}

interface FlappyGameProps {
  roomId: string;
  myBest: number | null;
}

export function FlappyGame({ roomId, myBest }: FlappyGameProps) {
  const [state, setState] = useState<FlappyState>(() =>
    createInitialState(makeSeed()),
  );
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const submittedRef = useRef(false);
  const runIdRef = useRef<string>(crypto.randomUUID());

  const doFlap = useCallback(() => {
    setState((s) => (s.gameOver ? s : flap(s)));
  }, []);

  // Game loop.
  useEffect(() => {
    if (state.gameOver) return;
    const id = window.setInterval(() => setState((s) => tick(s)), TICK_MS);
    return () => window.clearInterval(id);
  }, [state.gameOver]);

  // Keyboard.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.code === "Space") {
        e.preventDefault();
        doFlap();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [doFlap]);

  // Submit once on game over.
  useEffect(() => {
    if (!state.gameOver || submittedRef.current || state.score === 0) return;
    submittedRef.current = true;
    const score = state.score;
    const beatBest = score > (myBest ?? 0);
    void submitGameScore({
      roomId,
      gameKey: "flappy",
      score,
      runId: runIdRef.current,
    }).then((r) => {
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(
        beatBest ? copy.games.flappy.newHighScore : copy.games.flappy.saved(score),
      );
    });
  }, [state.gameOver, state.score, roomId, myBest]);

  // Render.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#0ea5e9";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.fillStyle = "#16a34a";
    for (const p of state.pipes) {
      ctx.fillRect(p.x, 0, PIPE_WIDTH, p.gapY);
      ctx.fillRect(p.x, p.gapY + PIPE_GAP, PIPE_WIDTH, HEIGHT - p.gapY - PIPE_GAP);
    }

    ctx.fillStyle = "#facc15";
    ctx.beginPath();
    ctx.arc(BIRD_X, state.birdY, BIRD_RADIUS, 0, Math.PI * 2);
    ctx.fill();
  }, [state]);

  const restart = useCallback(() => {
    submittedRef.current = false;
    runIdRef.current = crypto.randomUUID();
    setState(createInitialState(makeSeed()));
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm">
          <span className="text-muted-foreground">
            {copy.games.flappy.score}:
          </span>{" "}
          <span className="font-mono tabular-nums font-semibold">
            {state.score}
          </span>
        </p>
        <Button size="sm" variant="outline" onClick={restart}>
          {copy.games.flappy.restart}
        </Button>
      </div>
      <canvas
        ref={canvasRef}
        width={WIDTH}
        height={HEIGHT}
        onPointerDown={(e) => {
          e.preventDefault();
          doFlap();
        }}
        className="touch-none rounded-lg border"
        aria-label={copy.games.flappy.title}
      />
      <p className="text-sm text-muted-foreground">{copy.games.flappy.controls}</p>
      {state.gameOver && (
        <p className="text-sm font-medium text-destructive">
          {copy.games.flappy.gameOver}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Write the Flappy page**

Create `src/app/app/rooms/[id]/games/flappy/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FlappyGame } from "@/components/games/flappy/flappy-game";
import { copy } from "@/lib/copy";
import { getMyBestScore } from "@/lib/games/queries";
import { requireRoomAccess } from "@/lib/rooms/queries";

interface FlappyPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: FlappyPageProps): Promise<Metadata> {
  const { id } = await params;
  const access = await requireRoomAccess(id);
  return {
    title: access
      ? `${copy.games.flappy.title} · ${access.room.name}`
      : copy.games.flappy.title,
  };
}

export default async function FlappyPage({ params }: FlappyPageProps) {
  const { id } = await params;
  const access = await requireRoomAccess(id);
  if (!access) notFound();

  const myBest = await getMyBestScore(id, access.userId, "flappy");

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">
          {copy.games.flappy.title}
        </h2>
        <p className="text-sm text-muted-foreground">
          {copy.games.flappy.subtitle}
        </p>
      </div>
      <FlappyGame roomId={id} myBest={myBest} />
    </section>
  );
}
```

- [ ] **Step 4: Add the Flappy GameCard**

In `src/app/app/rooms/[id]/games/page.tsx`, add `flappyBest` to the destructured
`Promise.all`. Change:

```tsx
  const [snakeBest, snakeBoard, showCheated, balance, petBest, sessions, wealth] =
    await Promise.all([
      getMyBestScore(id, access.userId, "snake"),
      getRoomLeaderboard(id, "snake"),
      getShowCheated(id),
      getBibcoins(access.userId),
      getMyBestScore(id, access.userId, "petconnect"),
      getSessionStandings(id),
      getRoomWealth(id),
    ]);
```

to:

```tsx
  const [
    snakeBest,
    snakeBoard,
    showCheated,
    balance,
    petBest,
    sessions,
    wealth,
    flappyBest,
    tetrisBest,
    twenty48Best,
  ] = await Promise.all([
    getMyBestScore(id, access.userId, "snake"),
    getRoomLeaderboard(id, "snake"),
    getShowCheated(id),
    getBibcoins(access.userId),
    getMyBestScore(id, access.userId, "petconnect"),
    getSessionStandings(id),
    getRoomWealth(id),
    getMyBestScore(id, access.userId, "flappy"),
    getMyBestScore(id, access.userId, "tetris"),
    getMyBestScore(id, access.userId, "2048"),
  ]);
```

Then, immediately after the Snake `<GameCard ... emoji="🐍" myBest={snakeBest} />`,
insert all three new skill-game cards (Tetris and 2048 are wired up in their own
tasks but added here so the grid is done once):

```tsx
        <GameCard
          href={`/app/rooms/${id}/games/flappy`}
          title={copy.games.flappy.title}
          subtitle={copy.games.flappy.subtitle}
          emoji="🐦"
          myBest={flappyBest}
        />
        <GameCard
          href={`/app/rooms/${id}/games/tetris`}
          title={copy.games.tetris.title}
          subtitle={copy.games.tetris.subtitle}
          emoji="🧩"
          myBest={tetrisBest}
        />
        <GameCard
          href={`/app/rooms/${id}/games/2048`}
          title={copy.games.twenty48.title}
          subtitle={copy.games.twenty48.subtitle}
          emoji="🔢"
          myBest={twenty48Best}
        />
```

- [ ] **Step 5: Type-check + lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: PASS. (Tetris/2048 pages don't exist yet, but the cards are just
`Link`s — `tsc`/`lint` are clean; the links 404 until Tasks 7 & 9. That's fine.)

- [ ] **Step 6: Commit**

```bash
git add src/components/games/flappy/flappy-game.tsx src/app/app/rooms/[id]/games/flappy/page.tsx src/lib/copy.ts src/app/app/rooms/[id]/games/page.tsx
git commit -m "feat(flappy): playable Flappy Bird that pays 1 coin/pipe"
```

---

## Task 6: Tetris engine

**Files:**
- Create: `src/lib/games/tetris/engine.ts`
- Test: `tests/unit/tetris-engine.test.ts`

- [ ] **Step 1: Write the failing test (RED)**

Create `tests/unit/tetris-engine.test.ts`:

```ts
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
    const left = moveLeft(s);
    expect(left.active.x).toBe(s.active.x - 1);
    const right = moveRight(s);
    expect(right.active.x).toBe(s.active.x + 1);
  });

  it("gravity moves the active piece down one row", () => {
    const s = createInitialState(42);
    const next = tick(s);
    expect(next.active.y).toBe(s.active.y + 1);
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
    // The cleared bottom row is gone; the column it filled is now mostly empty.
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
    const after = hardDrop(state);
    expect(after.gameOver).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run tests/unit/tetris-engine.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the engine**

Create `src/lib/games/tetris/engine.ts`:

```ts
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
  I: 1,
  O: 2,
  T: 3,
  S: 4,
  Z: 5,
  J: 6,
  L: 7,
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

/** Rotated cells for a piece at rotation `rot` (CW), still in box coords. */
function rotatedCells(type: PieceType, rot: number): [number, number][] {
  const { size, cells } = PIECES[type];
  let cs = cells;
  const times = (((rot % 4) + 4) % 4);
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
    if (y >= 0 && board[y][x] !== 0) return false; // y < 0 is allowed above the top
  }
  return true;
}

function spawnX(type: PieceType): number {
  return type === "O" ? 4 : 3;
}

function spawnPiece(type: PieceType): ActivePiece {
  return { type, rot: 0, x: spawnX(type), y: 0 };
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run tests/unit/tetris-engine.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/games/tetris/engine.ts tests/unit/tetris-engine.test.ts
git commit -m "feat(tetris): seeded, unit-tested engine"
```

---

## Task 7: Tetris UI (client + page)

Copy and the GameCard were added in Task 5. This task adds the playable client
and its page.

**Files:**
- Create: `src/components/games/tetris/tetris-game.tsx`
- Create: `src/app/app/rooms/[id]/games/tetris/page.tsx`

- [ ] **Step 1: Write the Tetris client component**

Create `src/components/games/tetris/tetris-game.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { submitGameScore } from "@/app/_actions/games";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import {
  COLS,
  ROWS,
  cellsOf,
  createInitialState,
  hardDrop,
  moveLeft,
  moveRight,
  rotate,
  softDrop,
  tick,
  type TetrisState,
} from "@/lib/games/tetris/engine";

const CELL = 22;
const WIDTH = COLS * CELL;
const HEIGHT = ROWS * CELL;
const TICK_MS = 500;

const COLOURS: Record<number, string> = {
  1: "#22d3ee",
  2: "#facc15",
  3: "#a855f7",
  4: "#22c55e",
  5: "#ef4444",
  6: "#3b82f6",
  7: "#f97316",
};

function makeSeed(): number {
  return (Date.now() ^ Math.floor(Math.random() * 0xffffff)) | 0;
}

interface TetrisGameProps {
  roomId: string;
  myBest: number | null;
}

export function TetrisGame({ roomId, myBest }: TetrisGameProps) {
  const [state, setState] = useState<TetrisState>(() =>
    createInitialState(makeSeed()),
  );
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const submittedRef = useRef(false);
  const runIdRef = useRef<string>(crypto.randomUUID());

  // Gravity loop.
  useEffect(() => {
    if (state.gameOver) return;
    const id = window.setInterval(() => setState((s) => tick(s)), TICK_MS);
    return () => window.clearInterval(id);
  }, [state.gameOver]);

  // Keyboard.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const map: Record<string, (s: TetrisState) => TetrisState> = {
        ArrowLeft: moveLeft,
        ArrowRight: moveRight,
        ArrowUp: rotate,
        ArrowDown: softDrop,
        " ": hardDrop,
      };
      const fn = map[e.key];
      if (!fn) return;
      e.preventDefault();
      setState((s) => fn(s));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Submit once on game over.
  useEffect(() => {
    if (!state.gameOver || submittedRef.current || state.lines === 0) return;
    submittedRef.current = true;
    const score = state.lines;
    const beatBest = score > (myBest ?? 0);
    void submitGameScore({
      roomId,
      gameKey: "tetris",
      score,
      runId: runIdRef.current,
    }).then((r) => {
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(
        beatBest ? copy.games.tetris.newHighScore : copy.games.tetris.saved(score),
      );
    });
  }, [state.gameOver, state.lines, roomId, myBest]);

  // Render board + active piece.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    const paint = (x: number, y: number, colour: string) => {
      ctx.fillStyle = colour;
      ctx.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2);
    };

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const id = state.board[y][x];
        if (id !== 0) paint(x, y, COLOURS[id] ?? "#999");
      }
    }
    const activeColour = COLOURS[
      ({ I: 1, O: 2, T: 3, S: 4, Z: 5, J: 6, L: 7 } as const)[state.active.type]
    ];
    for (const [x, y] of cellsOf(state.active)) {
      if (y >= 0) paint(x, y, activeColour);
    }
  }, [state]);

  const restart = useCallback(() => {
    submittedRef.current = false;
    runIdRef.current = crypto.randomUUID();
    setState(createInitialState(makeSeed()));
  }, []);

  const press = (fn: (s: TetrisState) => TetrisState) => () =>
    setState((s) => fn(s));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm">
          <span className="text-muted-foreground">
            {copy.games.tetris.score}:
          </span>{" "}
          <span className="font-mono tabular-nums font-semibold">
            {state.lines}
          </span>
        </p>
        <Button size="sm" variant="outline" onClick={restart}>
          {copy.games.tetris.restart}
        </Button>
      </div>
      <canvas
        ref={canvasRef}
        width={WIDTH}
        height={HEIGHT}
        className="rounded-lg border"
        aria-label={copy.games.tetris.title}
      />
      <div className="flex flex-wrap gap-2 sm:hidden">
        <Button size="sm" variant="outline" onClick={press(moveLeft)}>
          {copy.games.tetris.left}
        </Button>
        <Button size="sm" variant="outline" onClick={press(rotate)}>
          {copy.games.tetris.rotate}
        </Button>
        <Button size="sm" variant="outline" onClick={press(moveRight)}>
          {copy.games.tetris.right}
        </Button>
        <Button size="sm" variant="outline" onClick={press(hardDrop)}>
          {copy.games.tetris.drop}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">{copy.games.tetris.controls}</p>
      {state.gameOver && (
        <p className="text-sm font-medium text-destructive">
          {copy.games.tetris.gameOver}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Write the Tetris page**

Create `src/app/app/rooms/[id]/games/tetris/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { TetrisGame } from "@/components/games/tetris/tetris-game";
import { copy } from "@/lib/copy";
import { getMyBestScore } from "@/lib/games/queries";
import { requireRoomAccess } from "@/lib/rooms/queries";

interface TetrisPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: TetrisPageProps): Promise<Metadata> {
  const { id } = await params;
  const access = await requireRoomAccess(id);
  return {
    title: access
      ? `${copy.games.tetris.title} · ${access.room.name}`
      : copy.games.tetris.title,
  };
}

export default async function TetrisPage({ params }: TetrisPageProps) {
  const { id } = await params;
  const access = await requireRoomAccess(id);
  if (!access) notFound();

  const myBest = await getMyBestScore(id, access.userId, "tetris");

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">
          {copy.games.tetris.title}
        </h2>
        <p className="text-sm text-muted-foreground">
          {copy.games.tetris.subtitle}
        </p>
      </div>
      <TetrisGame roomId={id} myBest={myBest} />
    </section>
  );
}
```

- [ ] **Step 3: Type-check + lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/games/tetris/tetris-game.tsx src/app/app/rooms/[id]/games/tetris/page.tsx
git commit -m "feat(tetris): playable Tetris that pays 1 coin/line"
```

---

## Task 8: 2048 engine

**Files:**
- Create: `src/lib/games/twenty48/engine.ts`
- Test: `tests/unit/twenty48-engine.test.ts`

- [ ] **Step 1: Write the failing test (RED)**

Create `tests/unit/twenty48-engine.test.ts`:

```ts
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
    const filled = a.grid.flat().filter((n) => n !== 0);
    expect(filled).toHaveLength(2);
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
    const count = moved.grid.flat().filter((n) => n !== 0).length;
    expect(moved.grid[0][0]).toBe(4);
    expect(count).toBe(2); // the merged 4 plus one freshly spawned tile
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
    const moved = move(state, "left");
    expect(moved.grid).toEqual(grid);
  });
});

describe("2048 engine — game over", () => {
  it("detects a full, unmergeable board", () => {
    const grid = [
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 2],
    ];
    expect(canMove(grid)).toBe(false);
  });

  it("allows a move when neighbours can merge", () => {
    const grid = [
      [2, 2, 4, 8],
      [4, 8, 16, 32],
      [2, 4, 8, 16],
      [4, 8, 16, 32],
    ];
    expect(canMove(grid)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run tests/unit/twenty48-engine.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the engine**

Create `src/lib/games/twenty48/engine.ts`:

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run tests/unit/twenty48-engine.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/games/twenty48/engine.ts tests/unit/twenty48-engine.test.ts
git commit -m "feat(2048): seeded, unit-tested engine"
```

---

## Task 9: 2048 UI (client + page)

Copy and the GameCard were added in Task 5. This task adds the playable client
and its page (route folder is the literal `2048`).

**Files:**
- Create: `src/components/games/twenty48/twenty48-game.tsx`
- Create: `src/app/app/rooms/[id]/games/2048/page.tsx`

- [ ] **Step 1: Write the 2048 client component**

Create `src/components/games/twenty48/twenty48-game.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { submitGameScore } from "@/app/_actions/games";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import {
  createInitialState,
  move,
  type Direction,
  type Game2048State,
} from "@/lib/games/twenty48/engine";

const TILE_COLOURS: Record<number, string> = {
  0: "bg-muted",
  2: "bg-amber-100 text-amber-950",
  4: "bg-amber-200 text-amber-950",
  8: "bg-orange-300 text-orange-950",
  16: "bg-orange-400 text-white",
  32: "bg-orange-500 text-white",
  64: "bg-red-500 text-white",
  128: "bg-yellow-400 text-yellow-950",
  256: "bg-yellow-500 text-white",
  512: "bg-green-500 text-white",
  1024: "bg-blue-500 text-white",
  2048: "bg-purple-600 text-white",
};

function makeSeed(): number {
  return (Date.now() ^ Math.floor(Math.random() * 0xffffff)) | 0;
}

const KEY_DIR: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

const SWIPE_MIN = 24;

interface Game2048Props {
  roomId: string;
  myBest: number | null;
}

export function Game2048({ roomId, myBest }: Game2048Props) {
  const [state, setState] = useState<Game2048State>(() =>
    createInitialState(makeSeed()),
  );
  const submittedRef = useRef(false);
  const runIdRef = useRef<string>(crypto.randomUUID());
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const doMove = useCallback((dir: Direction) => {
    setState((s) => move(s, dir));
  }, []);

  // Keyboard.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const dir = KEY_DIR[e.key];
      if (!dir) return;
      e.preventDefault();
      doMove(dir);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [doMove]);

  // Submit once on game over.
  useEffect(() => {
    if (!state.gameOver || submittedRef.current) return;
    submittedRef.current = true;
    const score = state.highestTile;
    const beatBest = score > (myBest ?? 0);
    void submitGameScore({
      roomId,
      gameKey: "2048",
      score,
      runId: runIdRef.current,
    }).then((r) => {
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(
        beatBest ? copy.games.twenty48.newHighScore : copy.games.twenty48.saved(score),
      );
    });
  }, [state.gameOver, state.highestTile, roomId, myBest]);

  const restart = useCallback(() => {
    submittedRef.current = false;
    runIdRef.current = crypto.randomUUID();
    setState(createInitialState(makeSeed()));
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm">
          <span className="text-muted-foreground">
            {copy.games.twenty48.score}:
          </span>{" "}
          <span className="font-mono tabular-nums font-semibold">
            {state.highestTile}
          </span>
        </p>
        <Button size="sm" variant="outline" onClick={restart}>
          {copy.games.twenty48.restart}
        </Button>
      </div>
      <div
        className="grid w-[280px] touch-none grid-cols-4 gap-2 rounded-lg border bg-card p-2"
        onPointerDown={(e) => {
          touchStart.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={(e) => {
          const start = touchStart.current;
          touchStart.current = null;
          if (!start) return;
          const dx = e.clientX - start.x;
          const dy = e.clientY - start.y;
          if (Math.abs(dx) < SWIPE_MIN && Math.abs(dy) < SWIPE_MIN) return;
          if (Math.abs(dx) > Math.abs(dy)) doMove(dx > 0 ? "right" : "left");
          else doMove(dy > 0 ? "down" : "up");
        }}
      >
        {state.grid.flat().map((value, i) => (
          <div
            key={i}
            className={`flex aspect-square items-center justify-center rounded-md text-lg font-bold tabular-nums ${
              TILE_COLOURS[value] ?? "bg-purple-700 text-white"
            }`}
          >
            {value !== 0 ? value : ""}
          </div>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">{copy.games.twenty48.controls}</p>
      {state.gameOver && (
        <p className="text-sm font-medium text-destructive">
          {copy.games.twenty48.gameOver}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Write the 2048 page**

Create `src/app/app/rooms/[id]/games/2048/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Game2048 } from "@/components/games/twenty48/twenty48-game";
import { copy } from "@/lib/copy";
import { getMyBestScore } from "@/lib/games/queries";
import { requireRoomAccess } from "@/lib/rooms/queries";

interface Game2048PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: Game2048PageProps): Promise<Metadata> {
  const { id } = await params;
  const access = await requireRoomAccess(id);
  return {
    title: access
      ? `${copy.games.twenty48.title} · ${access.room.name}`
      : copy.games.twenty48.title,
  };
}

export default async function Game2048Page({ params }: Game2048PageProps) {
  const { id } = await params;
  const access = await requireRoomAccess(id);
  if (!access) notFound();

  const myBest = await getMyBestScore(id, access.userId, "2048");

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">
          {copy.games.twenty48.title}
        </h2>
        <p className="text-sm text-muted-foreground">
          {copy.games.twenty48.subtitle}
        </p>
      </div>
      <Game2048 roomId={id} myBest={myBest} />
    </section>
  );
}
```

- [ ] **Step 3: Type-check + lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/games/twenty48/twenty48-game.tsx "src/app/app/rooms/[id]/games/2048/page.tsx"
git commit -m "feat(2048): playable 2048 that pays 1 coin per new tile"
```

---

## Task 10: Full verification & manual smoke

**Files:** none (verification only)

- [ ] **Step 1: Full gate**

Run: `pnpm exec tsc --noEmit && pnpm lint && pnpm test`
Expected: All green. If `pnpm build` is attempted and fails on `next/font`, ignore
(sandbox limitation noted in CLAUDE.md); rely on Vercel for the production build.

- [ ] **Step 2: Manual smoke (dev server)**

Run: `pnpm dev`, open a room's `/app/rooms/<id>/games`, then verify each:
- The grid shows 🐍 Snake, 🐦 Flappy Bird, 🧩 Tetris, 🔢 2048 cards (plus the
  existing gambling cards), each with a "Jouw beste" stat.
- **Snake:** eat several apples, die — a toast confirms the score and your
  bibcoin balance (header) rises by the number of apples eaten. Play again and
  confirm it pays *again* (no cap).
- **Flappy:** tap/space to fly through pipes; the score counts pipes; on death
  the balance rises by the pipe count.
- **Tetris:** clear at least one line; on game over the balance rises by lines
  cleared.
- **2048:** reach 16 or 32; on "no moves left" the balance rises by
  `log2(highest) − 1`.

- [ ] **Step 3: Verify idempotency note (optional, SQL editor)**

In Supabase, confirm new ledger rows exist with reasons
`snake_play` / `flappy_play` / `tetris_play` / `2048_play`, one per run (distinct
`ref` UUIDs). No daily cap is enforced — this is by design.

- [ ] **Step 4: Update `todo.md` and the migration/architecture note (docs)**

Tick the relevant roadmap item in `todo.md` if present, and add a one-line note
to `CLAUDE.md`'s games section that Snake/Flappy/Tetris/2048 are skill games
paying coins per event via `earnFromArcade` (no migration). Commit:

```bash
git add todo.md CLAUDE.md
git commit -m "docs: note skill games pay coins per event (no cap)"
```

---

## Self-Review

**Spec coverage:**
- Snake → 1 coin/apple every run, no cap → Task 3 (`earnFromArcade`, `snake` branch). King prize + achievements preserved (achievements in Task 3; King untouched — no code change). ✓
- Flappy Bird, 1 coin/pipe → Tasks 4–5. ✓
- Tetris, 1 coin/line → Tasks 6–7. ✓
- 2048, 1 coin per new highest tile via `log2−1` → Tasks 2, 8–9. ✓
- No cap, idempotent per-run via `runId` → Tasks 1 (schema) + 3 (`awardBibcoins(..., runId)`). ✓
- 100 000 per-run safety bound → Task 1 (`score.max(100_000)`), unchanged. ✓
- Zero migrations → no migration task anywhere; `game_scores.game_key` is text. ✓
- GameCards show best via `getMyBestScore` → Task 5. ✓
- Dutch copy in `copy.ts` → Task 5. ✓
- No dedicated leaderboards / King prizes for the new three → pages omit `<Leaderboard>`. ✓

**Placeholder scan:** No TBD/TODO/"handle edge cases"; every code step has full code. ✓

**Type consistency:**
- `arcadeCoins(gameKey, score)` defined in Task 2, used in Task 3. ✓
- `earnFromArcade(userId, gameKey, score, runId, cheated)` defined in Task 3, called with that exact arity in `games.ts`. ✓
- `submitScoreSchema` gains `runId` (Task 1), supplied by every `submitGameScore` caller: snake + petconnect (Task 3), flappy (Task 5), tetris (Task 7), 2048 (Task 9). ✓
- Engine exports referenced by clients: flappy (`WIDTH/HEIGHT/BIRD_X/BIRD_RADIUS/PIPE_WIDTH/PIPE_GAP/createInitialState/flap/tick/FlappyState`), tetris (`COLS/ROWS/cellsOf/createInitialState/hardDrop/moveLeft/moveRight/rotate/softDrop/tick/TetrisState`), 2048 (`createInitialState/move/Direction/Game2048State`) — all exported in their Task. ✓
- `GameKey` now includes `"2048"`; `getMyBestScore(..., "2048")` type-checks. ✓

**Note on `2048` as a key/route:** the gameKey string and route folder are
`2048`; only JS identifiers (copy key `twenty48`, component `Game2048`, dirs
`twenty48`) avoid the leading digit. The Task 9 commit quotes the bracketed path
for the shell.
