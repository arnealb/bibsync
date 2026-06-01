# Skill Games That Pay Bibcoins — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify all skill games on one earning model — **per-game coins/event (Snake 3, Flappy 3, Tetris 8, 2048 12), shared 250-coins/hour cap** — add Tetris and 2048, and give **every skill game a daily King** (Snake 1000, the rest 500) like the existing Snake King.

**Architecture:** Each new game is a pure, seeded, unit-tested engine + a thin `"use client"` component that submits a score on game-over. `submitGameScore` routes `petconnect` to its daily reward and `snake`/`flappy`/`tetris`/`2048` to a new `earnFromArcade`, which pays a **per-game rate × events** (Snake/Flappy 3 per apple/pipe, Tetris 8 per line, 2048 12 per new tile = `log2−1`), clamped to a **shared 250/hour** headroom read from the ledger, with a fresh server-side `crypto.randomUUID()` ref (no client `runId`). A new cron migration (`0050`) pays each non-Snake skill game's daily King 500; the crown badge is generalised per game. **Only DB change is the manual cron migration** — scores and payouts use existing tables.

> **Merge note:** a teammate already shipped a Flappy-only cap (`earnFromFlappy`, `FLAPPY_HOURLY_CAP = 250`, `flappyBestPerPoint: 10`). This plan generalises it: rename `FLAPPY_HOURLY_CAP` → `ARCADE_HOURLY_CAP` (shared) and replace `earnFromFlappy`/`earnFromSnake` with `earnFromArcade`. Migrations `0048_hilo`/`0049_pillory` already exist, so the King migration is **`0050`**.

**Tech Stack:** Next.js 16 (App Router, RSC + Server Actions), React 19, TS strict, Zod, Vitest, Supabase (`game_scores` + `award_bibcoins` RPC + `pg_cron`), Tailwind + base-nova shadcn.

**Conventions (CLAUDE.md):** Dutch strings in `copy.ts`; English code; pure seeded engines; never import the server client into a `"use client"` file; gate on `pnpm exec tsc --noEmit` + `pnpm lint` + `pnpm test` (local `pnpm build` may fail on `next/font` — ignore).

**Do NOT touch:** `flappy-game.tsx`, the Flappy engine, Keno, Snake/Pet Connect client components, Snake King migration `0047`. The Flappy and Pet Connect *pages* only gain two King props (the feature the owner asked for), not gameplay.

**Commit after every task.** Branch `feat/skill-games-coins` (already created; `main` merged in).

---

## File Structure

- Modify `src/lib/validation/games.ts` — add `tetris`, `2048` keys.
- Modify `src/lib/bibcoins/config.ts` — add `ARCADE_COINS_PER_EVENT` rate map; rename `FLAPPY_HOURLY_CAP` → `ARCADE_HOURLY_CAP` (now shared); remove `snakeBestPerPoint`, `flappyBestPerPoint`.
- Create `src/lib/games/arcade-coins.ts` — `arcadeCoins` + `cappedCoins`.
- Modify `src/lib/bibcoins/earn.ts` — delete `earnFromSnake` + `earnFromFlappy`; add `earnFromArcade`.
- Modify `src/app/_actions/games.ts` — route `petconnect`→daily, else→`earnFromArcade`.
- King: Modify `src/lib/games/constants.ts` (`GAME_KING_REWARD`), `src/lib/copy.ts` (`copy.games.king`), `src/components/games/leaderboard.tsx` (`kingLabel`); create `src/components/games/king-badge.tsx` (replaces `snake-king-badge.tsx`); add King props to `…/games/flappy/page.tsx` + `…/games/petconnect/page.tsx`; create `supabase/migrations/0050_game_kings.sql`.
- Tetris: `src/lib/games/tetris/engine.ts` (+test), `src/components/games/tetris/tetris-game.tsx`, `…/games/tetris/page.tsx`.
- 2048: `src/lib/games/twenty48/engine.ts` (+test), `src/components/games/twenty48/twenty48-game.tsx`, `…/games/2048/page.tsx`.
- Modify `src/app/app/rooms/[id]/games/page.tsx` — Tetris + 2048 cards.
- Modify `src/lib/copy.ts` — `copy.games.tetris`, `copy.games.twenty48`.
- Modify `tests/unit/games-validation.test.ts`.

---

## Task 1: Validation keys + config

**Files:** Modify `src/lib/validation/games.ts`, `src/lib/bibcoins/config.ts`; Test `tests/unit/games-validation.test.ts`.

- [ ] **Step 1: Update the validation test (RED)** — replace the body of `tests/unit/games-validation.test.ts` with:

```ts
import { describe, expect, it } from "vitest";

import { submitScoreSchema } from "@/lib/validation/games";

describe("submitScoreSchema", () => {
  const baseInput = {
    roomId: "11111111-1111-1111-8111-111111111111",
    gameKey: "snake" as const,
    score: 10,
  };

  it("accepts a valid input", () => {
    expect(submitScoreSchema.safeParse(baseInput).success).toBe(true);
  });

  it("accepts the skill-game keys", () => {
    for (const gameKey of ["snake", "flappy", "tetris", "2048"] as const) {
      expect(
        submitScoreSchema.safeParse({ ...baseInput, gameKey }).success,
      ).toBe(true);
    }
  });

  it("rejects a non-uuid roomId", () => {
    expect(
      submitScoreSchema.safeParse({ ...baseInput, roomId: "abc" }).success,
    ).toBe(false);
  });

  it("rejects an unknown gameKey", () => {
    expect(
      submitScoreSchema.safeParse({ ...baseInput, gameKey: "pacman" }).success,
    ).toBe(false);
  });

  it("rejects a negative score", () => {
    expect(
      submitScoreSchema.safeParse({ ...baseInput, score: -1 }).success,
    ).toBe(false);
  });

  it("rejects a non-integer score", () => {
    expect(
      submitScoreSchema.safeParse({ ...baseInput, score: 1.5 }).success,
    ).toBe(false);
  });

  it("rejects scores above the sanity cap", () => {
    expect(
      submitScoreSchema.safeParse({ ...baseInput, score: 100_001 }).success,
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run it (FAIL)** — `pnpm exec vitest run tests/unit/games-validation.test.ts` → `tetris`/`2048` rejected.

- [ ] **Step 3: Add keys** — in `src/lib/validation/games.ts` change:

```ts
export const GAME_KEYS = ["snake", "petconnect", "flappy"] as const;
```

to:

```ts
export const GAME_KEYS = [
  "snake",
  "petconnect",
  "flappy",
  "tetris",
  "2048",
] as const;
```

- [ ] **Step 4: Config** — in `src/lib/bibcoins/config.ts`, add the per-game rate map. The hourly-cap constant already exists from the teammate's Flappy work (`export const FLAPPY_HOURLY_CAP = 250;`) and is renamed to `ARCADE_HOURLY_CAP` in Task 3; the two `*PerPoint` rewards are removed in Task 3. Add this just below the `export const FLAPPY_HOURLY_CAP = 250;` line:

```ts
/**
 * Coins per coin-event, tuned per game so faster/easier points pay less:
 * snake/flappy = per apple/pipe, tetris = per line, 2048 = per new tile
 * (a milestone = log2−1). Shared 250/hour cap bounds the total.
 */
export const ARCADE_COINS_PER_EVENT = {
  snake: 3,
  flappy: 3,
  tetris: 8,
  "2048": 12,
} as const;
```

- [ ] **Step 5: Run it (PASS)** — `pnpm exec vitest run tests/unit/games-validation.test.ts`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/validation/games.ts src/lib/bibcoins/config.ts tests/unit/games-validation.test.ts
git commit -m "feat(games): add tetris/2048 keys + per-game arcade rate map"
```

---

## Task 2: Pure coin math (`arcadeCoins` + `cappedCoins`)

**Files:** Create `src/lib/games/arcade-coins.ts`; Test `tests/unit/arcade-coins.test.ts`.

- [ ] **Step 1: Write the failing test (RED)** — create `tests/unit/arcade-coins.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { arcadeCoins, cappedCoins } from "@/lib/games/arcade-coins";

describe("arcadeCoins", () => {
  it("applies the per-game rate per event (snake/flappy 3, tetris 8)", () => {
    expect(arcadeCoins("snake", 17)).toBe(51); // 17 × 3
    expect(arcadeCoins("flappy", 4)).toBe(12); // 4 × 3
    expect(arcadeCoins("tetris", 9)).toBe(72); // 9 × 8
  });

  it("is 12 per new-highest-tile milestone for 2048", () => {
    expect(arcadeCoins("2048", 2)).toBe(0); // start tile, no milestone
    expect(arcadeCoins("2048", 4)).toBe(12); // 1 milestone × 12
    expect(arcadeCoins("2048", 256)).toBe(84); // 7 × 12
    expect(arcadeCoins("2048", 2048)).toBe(120); // 10 × 12
  });

  it("never pays for a zero or negative score", () => {
    expect(arcadeCoins("snake", 0)).toBe(0);
    expect(arcadeCoins("flappy", -3)).toBe(0);
  });
});

describe("cappedCoins", () => {
  it("pays the full amount under the cap", () => {
    expect(cappedCoins(100, 0, 250)).toBe(100);
    expect(cappedCoins(100, 100, 250)).toBe(100);
  });

  it("clamps to the remaining headroom", () => {
    expect(cappedCoins(100, 200, 250)).toBe(50);
  });

  it("pays nothing at or over the cap, never negative", () => {
    expect(cappedCoins(100, 250, 250)).toBe(0);
    expect(cappedCoins(100, 300, 250)).toBe(0);
  });
});
```

- [ ] **Step 2: Run it (FAIL)** — `pnpm exec vitest run tests/unit/arcade-coins.test.ts`.

- [ ] **Step 3: Implement** — create `src/lib/games/arcade-coins.ts`:

```ts
import { ARCADE_COINS_PER_EVENT } from "@/lib/bibcoins/config";
import type { GameKey } from "@/lib/validation/games";

/**
 * Coins for one finished skill run: the per-game rate × coin-events. Events are
 * the score (apples / pipes / lines) for snake/flappy/tetris; for 2048 the score
 * is the highest tile (a power of two) and events = log2(tile) − 1 (256 → 7).
 * Per-game rates (config) are tuned so faster/easier points pay less.
 */
export function arcadeCoins(gameKey: GameKey, score: number): number {
  if (score <= 0) return 0;
  const events =
    gameKey === "2048" ? Math.max(0, Math.round(Math.log2(score)) - 1) : score;
  const rate =
    ARCADE_COINS_PER_EVENT[gameKey as keyof typeof ARCADE_COINS_PER_EVENT] ?? 0;
  return events * rate;
}

/** Clamp a desired payout to the remaining hourly headroom (never negative). */
export function cappedCoins(
  desired: number,
  earnedThisHour: number,
  cap: number,
): number {
  return Math.max(0, Math.min(desired, cap - earnedThisHour));
}
```

- [ ] **Step 4: Run it (PASS)** — `pnpm exec vitest run tests/unit/arcade-coins.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/games/arcade-coins.ts tests/unit/arcade-coins.test.ts
git commit -m "feat(games): pure coin math + hourly-cap clamp for skill games"
```

---

## Task 3: `earnFromArcade` with shared hourly cap + wiring

Replaces `earnFromSnake` **and** `earnFromFlappy` with one capped path for
`snake`/`flappy`/`tetris`/`2048`. No client changes (server-side ref).

**Files:** Modify `src/lib/bibcoins/earn.ts`, `src/lib/bibcoins/config.ts`, `src/app/_actions/games.ts`.

- [ ] **Step 1: Edit `src/lib/bibcoins/earn.ts`** — add imports at the top (keep existing ones):

```ts
import { ARCADE_HOURLY_CAP } from "@/lib/bibcoins/config";
import { arcadeCoins, cappedCoins } from "@/lib/games/arcade-coins";
import type { GameKey } from "@/lib/validation/games";
```

> `earn.ts` currently imports `FLAPPY_HOURLY_CAP` from `@/lib/bibcoins/config`
> (used by the old `earnFromFlappy`). Change that import to `ARCADE_HOURLY_CAP`
> (renamed in Step 2), and add the `arcadeCoins`/`cappedCoins` and `GameKey`
> imports shown above.

Delete the entire `earnFromSnake` function **and** the entire `earnFromFlappy`
function, and in their place add:

```ts
/** Per-event skill games whose payouts share the hourly cap (also the ledger
 * `reason` for each). */
const ARCADE_REASONS = ["snake", "flappy", "tetris", "2048"] as const;

/**
 * A finished per-event skill run pays the per-game `arcadeCoins` amount,
 * clamped so these four games together pay at most ARCADE_HOURLY_CAP per rolling
 * hour. A fresh server-side ref means every run can pay (the cap, not
 * idempotency, governs the total). Cheated (autopilot) runs earn nothing; Snake
 * keeps its score achievements.
 */
export async function earnFromArcade(
  userId: string,
  gameKey: GameKey,
  score: number,
  cheated: boolean,
): Promise<void> {
  if (cheated || score <= 0) return;

  if (gameKey === "snake") {
    if (score >= 25) await unlockAchievement(userId, "snake_25");
    if (score >= 100) await unlockAchievement(userId, "snake_100");
  }

  const desired = arcadeCoins(gameKey, score);
  if (desired <= 0) return;

  const admin = createAdminClient();
  if (!admin) return;

  const sinceIso = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data } = await admin
    .from("bibcoin_transactions")
    .select("amount")
    .eq("user_id", userId)
    .in("reason", ARCADE_REASONS as unknown as string[])
    .gte("created_at", sinceIso);
  const earnedThisHour = (data ?? []).reduce(
    (sum: number, row: { amount: number }) => sum + row.amount,
    0,
  );

  const coins = cappedCoins(desired, earnedThisHour, ARCADE_HOURLY_CAP);
  if (coins > 0) {
    await awardBibcoins(userId, coins, gameKey, crypto.randomUUID());
  }
}
```

- [ ] **Step 2: Rename the cap + remove old rewards** — in `src/lib/bibcoins/config.ts`:

Rename the Flappy-only cap to the shared one — change:

```ts
/** Max bibcoins earnable from Flappy Bird per rolling hour (anti-abuse). */
export const FLAPPY_HOURLY_CAP = 250;
```

to:

```ts
/** Shared cap on per-event skill-game coins (snake/flappy/tetris/2048) per
 * rolling hour (anti-abuse). */
export const ARCADE_HOURLY_CAP = 250;
```

Then delete the two now-unused `REWARD` lines (their callers are gone):

```ts
  /** Per +1 of a new honest Snake personal best. */
  snakeBestPerPoint: 1,
```

```ts
  /** Per Flappy Bird point, paid on every run (capped — see FLAPPY_HOURLY_CAP). */
  flappyBestPerPoint: 10,
```

- [ ] **Step 3: Route in `src/app/_actions/games.ts`** — change the import:

```ts
import {
  earnFromFlappy,
  earnFromPetConnect,
  earnFromSnake,
} from "@/lib/bibcoins/earn";
```

to:

```ts
import { earnFromArcade, earnFromPetConnect } from "@/lib/bibcoins/earn";
```

and replace the routing block:

```ts
  if (parsed.data.gameKey === "snake") {
    await earnFromSnake(
      access.userId,
      parsed.data.score,
      parsed.data.cheated ?? false,
    );
  } else if (parsed.data.gameKey === "petconnect") {
    await earnFromPetConnect(access.userId);
  } else if (parsed.data.gameKey === "flappy") {
    await earnFromFlappy(access.userId, parsed.data.score);
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
      parsed.data.cheated ?? false,
    );
  }
```

- [ ] **Step 4: Gate** — `pnpm exec tsc --noEmit && pnpm lint && pnpm test` → green (no refs to `earnFromSnake`/`earnFromFlappy`/`snakeBestPerPoint`/`flappyBestPerPoint`).

- [ ] **Step 5: Commit**

```bash
git add src/lib/bibcoins/earn.ts src/lib/bibcoins/config.ts src/app/_actions/games.ts
git commit -m "feat(games): unified arcade earning, per-game rates, shared 250/hour cap"
```

---

## Task 4: Daily Kings for the other skill games

Adds a 500/day King for Flappy, Tetris, 2048 and Pet Connect (Snake King 0047
unchanged), and generalises the crown badge.

**Files:** Modify `src/lib/games/constants.ts`, `src/lib/copy.ts`, `src/components/games/leaderboard.tsx`, `…/games/flappy/page.tsx`, `…/games/petconnect/page.tsx`; Create `src/components/games/king-badge.tsx` (and `git rm` `snake-king-badge.tsx`); Create `supabase/migrations/0050_game_kings.sql`.

- [ ] **Step 1: Constant** — in `src/lib/games/constants.ts` add (keep `SNAKE_KING_REWARD`):

```ts
/**
 * Daily bibcoins paid to the reigning King of each non-Snake skill game
 * (Flappy / Tetris / 2048 / Pet Connect). Keep in sync with the 500 in
 * supabase/migrations/0050_game_kings.sql.
 */
export const GAME_KING_REWARD = 500;
```

- [ ] **Step 2: Copy** — in `src/lib/copy.ts`, inside the `games:` object, replace the existing `snakeKing` block:

```ts
    snakeKing: {
      label: "Snake King",
      tooltip: (n: number) => `Snake King · +${n} bibcoins/dag 👑`,
    },
```

with a generic block:

```ts
    king: {
      tooltip: (label: string, n: number) =>
        `${label} · +${n} bibcoins/dag 👑`,
      snake: "Snake King",
      flappy: "Flappy King",
      tetris: "Tetris King",
      twenty48: "2048 King",
      petconnect: "Pet Connect King",
    },
```

- [ ] **Step 3: Generalise the badge** — create `src/components/games/king-badge.tsx`:

```tsx
import { Crown } from "lucide-react";

import { copy } from "@/lib/copy";
import { cn } from "@/lib/utils";

/**
 * Gold crown badge for a game's reigning #1 honest scorer. `label` is the crown
 * text (e.g. "Snake King"); `reward` is the daily bibcoins payout (tooltip).
 * Kept in sync with the cron jobs in 0047/0050.
 */
export function KingBadge({
  reward,
  label,
  className,
}: {
  reward: number;
  label: string;
  className?: string;
}) {
  const tooltip = copy.games.king.tooltip(label, reward);
  return (
    <span
      title={tooltip}
      aria-label={tooltip}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full bg-gradient-to-r from-amber-300 to-yellow-500 px-1.5 py-0.5 text-[10px] font-bold text-amber-950 shadow-sm ring-1 ring-amber-500/40",
        className,
      )}
    >
      <Crown className="size-3 fill-amber-950" aria-hidden />
      {label}
    </span>
  );
}
```

Then delete the old file:

```bash
git rm src/components/games/snake-king-badge.tsx
```

- [ ] **Step 4: Leaderboard** — in `src/components/games/leaderboard.tsx`:

Change the import:

```ts
import { SnakeKingBadge } from "@/components/games/snake-king-badge";
```

to:

```ts
import { KingBadge } from "@/components/games/king-badge";
```

Add a `kingLabel` prop — change:

```ts
  /** If set, the honest #1 is the daily Snake King earning this many coins/day. */
  kingReward?: number;
}
```

to:

```ts
  /** If set, the honest #1 is the daily King earning this many coins/day. */
  kingReward?: number;
  /** Crown text for the King badge; defaults to "Snake King". */
  kingLabel?: string;
}
```

Destructure it — change `kingReward,` in the props destructure to:

```ts
  kingReward,
  kingLabel,
```

And change the badge render:

```tsx
                {kingReward != null && !showCheated && index === 0 && (
                  <SnakeKingBadge reward={kingReward} />
                )}
```

to:

```tsx
                {kingReward != null && !showCheated && index === 0 && (
                  <KingBadge
                    reward={kingReward}
                    label={kingLabel ?? copy.games.king.snake}
                  />
                )}
```

(`copy` is already imported in this file. The Snake page passes only
`kingReward`, so it falls back to "Snake King" — unchanged.)

- [ ] **Step 5: Flappy page King** — in `src/app/app/rooms/[id]/games/flappy/page.tsx` add the import:

```ts
import { GAME_KING_REWARD } from "@/lib/games/constants";
```

and add the two props to the existing `<Leaderboard …>` (after `initialShowCheated={false}`):

```tsx
        kingReward={GAME_KING_REWARD}
        kingLabel={copy.games.king.flappy}
```

- [ ] **Step 6: Pet Connect page King** — in `src/app/app/rooms/[id]/games/petconnect/page.tsx` add the import:

```ts
import { GAME_KING_REWARD } from "@/lib/games/constants";
```

and add to the existing `<Leaderboard …>` (after `initialShowCheated={showCheated}`):

```tsx
        kingReward={GAME_KING_REWARD}
        kingLabel={copy.games.king.petconnect}
```

- [ ] **Step 7: Cron migration** — create `supabase/migrations/0050_game_kings.sql`:

```sql
-- ============================================================================
-- BibSync — daily "King" for the non-Snake skill games (Flappy, Tetris, 2048,
-- Pet Connect). Mirrors 0047_snake_king.sql but pays 500 and covers four games.
-- Just after Brussels midnight, the top HONEST scorer per room per game wins
-- 500 bibcoins. Idempotent per (game, room, Brussels date) via the
-- award_bibcoins ledger. Two UTC cron times cover both DST offsets. Requires
-- pg_cron. Run manually in the Supabase SQL editor, after 0047.
--
-- NOTE: the 500 below must stay in sync with GAME_KING_REWARD in
-- src/lib/games/constants.ts.
-- ============================================================================

create extension if not exists pg_cron;

create or replace function public.award_game_kings()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _today date := (now() at time zone 'Europe/Brussels')::date;
  _game  text;
  _games text[] := array['flappy','tetris','2048','petconnect'];
  _rec   record;
begin
  foreach _game in array _games loop
    for _rec in
      select distinct on (room_id) room_id, user_id
      from public.game_scores
      where game_key = _game and not cheated
      order by room_id, score desc, created_at asc -- ties: earliest record holder
    loop
      perform public.award_bibcoins(
        _rec.user_id,
        500,
        _game || '_king',
        _rec.room_id::text || ':' || _today::text
      );
    end loop;
  end loop;
end;
$$;

revoke execute on function public.award_game_kings() from public, authenticated;
grant execute on function public.award_game_kings() to service_role;

do $$
begin
  perform cron.unschedule('game-kings-winter');
exception when others then null;
end $$;
do $$
begin
  perform cron.unschedule('game-kings-summer');
exception when others then null;
end $$;

select cron.schedule('game-kings-winter', '1 23 * * *',
  $$select public.award_game_kings()$$);
select cron.schedule('game-kings-summer', '1 22 * * *',
  $$select public.award_game_kings()$$);
```

- [ ] **Step 8: Gate** — `pnpm exec tsc --noEmit && pnpm lint && pnpm test` → green.

- [ ] **Step 9: Commit**

```bash
git add src/lib/games/constants.ts src/lib/copy.ts src/components/games/king-badge.tsx src/components/games/leaderboard.tsx "src/app/app/rooms/[id]/games/flappy/page.tsx" "src/app/app/rooms/[id]/games/petconnect/page.tsx" supabase/migrations/0050_game_kings.sql
git commit -m "feat(games): daily King (500) for flappy/tetris/2048/petconnect"
```

---

## Task 5: Tetris engine

**Files:** Create `src/lib/games/tetris/engine.ts`; Test `tests/unit/tetris-engine.test.ts`.

- [ ] **Step 1: Write the failing test (RED)** — create `tests/unit/tetris-engine.test.ts`:

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
    expect(moveLeft(s).active.x).toBe(s.active.x - 1);
    expect(moveRight(s).active.x).toBe(s.active.x + 1);
  });

  it("gravity moves the active piece down one row", () => {
    const s = createInitialState(42);
    expect(tick(s).active.y).toBe(s.active.y + 1);
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
    expect(hardDrop(state).gameOver).toBe(true);
  });
});
```

- [ ] **Step 2: Run it (FAIL)** — `pnpm exec vitest run tests/unit/tetris-engine.test.ts`.

- [ ] **Step 3: Implement** — create `src/lib/games/tetris/engine.ts`:

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
```

- [ ] **Step 4: Run it (PASS)** — `pnpm exec vitest run tests/unit/tetris-engine.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/games/tetris/engine.ts tests/unit/tetris-engine.test.ts
git commit -m "feat(tetris): seeded, unit-tested engine"
```

---

## Task 6: Tetris UI (client + page + card + copy)

**Files:** Create `src/components/games/tetris/tetris-game.tsx`, `…/games/tetris/page.tsx`; Modify `src/lib/copy.ts`, `src/app/app/rooms/[id]/games/page.tsx`.

- [ ] **Step 1: Copy** — in `src/lib/copy.ts`, inside `games:`, immediately after the existing `flappy: { … },` block, insert:

```ts
    tetris: {
      title: "Tetris",
      subtitle: "Maak rijen vol — coins per rij",
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
```

- [ ] **Step 2: Client** — create `src/components/games/tetris/tetris-game.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { submitGameScore } from "@/app/_actions/games";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import {
  COLS,
  PIECE_ID,
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
  1: "#22d3ee", 2: "#facc15", 3: "#a855f7", 4: "#22c55e",
  5: "#ef4444", 6: "#3b82f6", 7: "#f97316",
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

  useEffect(() => {
    if (state.gameOver) return;
    const id = window.setInterval(() => setState((s) => tick(s)), TICK_MS);
    return () => window.clearInterval(id);
  }, [state.gameOver]);

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

  useEffect(() => {
    if (!state.gameOver || submittedRef.current || state.lines === 0) return;
    submittedRef.current = true;
    const score = state.lines;
    const beatBest = score > (myBest ?? 0);
    void submitGameScore({ roomId, gameKey: "tetris", score }).then((r) => {
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(
        beatBest ? copy.games.tetris.newHighScore : copy.games.tetris.saved(score),
      );
    });
  }, [state.gameOver, state.lines, roomId, myBest]);

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
    const activeColour = COLOURS[PIECE_ID[state.active.type]] ?? "#999";
    for (const [x, y] of cellsOf(state.active)) {
      if (y >= 0) paint(x, y, activeColour);
    }
  }, [state]);

  const restart = useCallback(() => {
    submittedRef.current = false;
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

- [ ] **Step 3: Page (with King leaderboard)** — create `src/app/app/rooms/[id]/games/tetris/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Leaderboard } from "@/components/games/leaderboard";
import { TetrisGame } from "@/components/games/tetris/tetris-game";
import { copy } from "@/lib/copy";
import { GAME_KING_REWARD } from "@/lib/games/constants";
import {
  getMyBestScore,
  getRoomLeaderboard,
  getShowCheated,
} from "@/lib/games/queries";
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

  const [myBest, board, showCheated] = await Promise.all([
    getMyBestScore(id, access.userId, "tetris"),
    getRoomLeaderboard(id, "tetris"),
    getShowCheated(id),
  ]);

  return (
    <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
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
      <Leaderboard
        title={`${copy.games.leaderboard} — ${copy.games.tetris.title}`}
        roomId={id}
        full={board.full}
        honest={board.honest}
        initialShowCheated={showCheated}
        kingReward={GAME_KING_REWARD}
        kingLabel={copy.games.king.tetris}
      />
    </div>
  );
}
```

- [ ] **Step 4: GameCard** — in `src/app/app/rooms/[id]/games/page.tsx`, add `tetrisBest` to the destructure — change:

```tsx
    wealth,
    flappyBest,
  ] = await Promise.all([
```

to:

```tsx
    wealth,
    flappyBest,
    tetrisBest,
  ] = await Promise.all([
```

and the fetch — change:

```tsx
    getMyBestScore(id, access.userId, "flappy"),
  ]);
```

to:

```tsx
    getMyBestScore(id, access.userId, "flappy"),
    getMyBestScore(id, access.userId, "tetris"),
  ]);
```

Then add the card right after the existing Flappy `<GameCard … emoji="🐤" myBest={flappyBest} />`:

```tsx
        <GameCard
          href={`/app/rooms/${id}/games/tetris`}
          title={copy.games.tetris.title}
          subtitle={copy.games.tetris.subtitle}
          emoji="🧩"
          myBest={tetrisBest}
        />
```

- [ ] **Step 5: Gate** — `pnpm exec tsc --noEmit && pnpm lint`.

- [ ] **Step 6: Commit**

```bash
git add src/components/games/tetris/tetris-game.tsx "src/app/app/rooms/[id]/games/tetris/page.tsx" src/lib/copy.ts "src/app/app/rooms/[id]/games/page.tsx"
git commit -m "feat(tetris): playable Tetris with King leaderboard"
```

---

## Task 7: 2048 engine

**Files:** Create `src/lib/games/twenty48/engine.ts`; Test `tests/unit/twenty48-engine.test.ts`.

- [ ] **Step 1: Write the failing test (RED)** — create `tests/unit/twenty48-engine.test.ts`:

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
```

- [ ] **Step 2: Run it (FAIL)** — `pnpm exec vitest run tests/unit/twenty48-engine.test.ts`.

- [ ] **Step 3: Implement** — create `src/lib/games/twenty48/engine.ts`:

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

- [ ] **Step 4: Run it (PASS)** — `pnpm exec vitest run tests/unit/twenty48-engine.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/games/twenty48/engine.ts tests/unit/twenty48-engine.test.ts
git commit -m "feat(2048): seeded, unit-tested engine"
```

---

## Task 8: 2048 UI (client + page + card + copy)

**Files:** Create `src/components/games/twenty48/twenty48-game.tsx`, `…/games/2048/page.tsx`; Modify `src/lib/copy.ts`, `src/app/app/rooms/[id]/games/page.tsx`.

- [ ] **Step 1: Copy** — in `src/lib/copy.ts`, inside `games:`, immediately after the `tetris: { … },` block from Task 6, insert:

```ts
    twenty48: {
      title: "2048",
      subtitle: "Veeg en combineer — coins per nieuwe tegel",
      score: "Hoogste tegel",
      controls: "Pijltjes of vegen om te schuiven",
      gameOver: "Geen zetten meer",
      restart: "Opnieuw",
      newHighScore: "Nieuwe high score!",
      saved: (n: number) => `Tegel ${n} bereikt`,
    },
```

- [ ] **Step 2: Client** — create `src/components/games/twenty48/twenty48-game.tsx`:

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
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const doMove = useCallback((dir: Direction) => {
    setState((s) => move(s, dir));
  }, []);

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

  useEffect(() => {
    if (!state.gameOver || submittedRef.current) return;
    submittedRef.current = true;
    const score = state.highestTile;
    const beatBest = score > (myBest ?? 0);
    void submitGameScore({ roomId, gameKey: "2048", score }).then((r) => {
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

- [ ] **Step 3: Page (with King leaderboard)** — create `src/app/app/rooms/[id]/games/2048/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Leaderboard } from "@/components/games/leaderboard";
import { Game2048 } from "@/components/games/twenty48/twenty48-game";
import { copy } from "@/lib/copy";
import { GAME_KING_REWARD } from "@/lib/games/constants";
import {
  getMyBestScore,
  getRoomLeaderboard,
  getShowCheated,
} from "@/lib/games/queries";
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

  const [myBest, board, showCheated] = await Promise.all([
    getMyBestScore(id, access.userId, "2048"),
    getRoomLeaderboard(id, "2048"),
    getShowCheated(id),
  ]);

  return (
    <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
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
      <Leaderboard
        title={`${copy.games.leaderboard} — ${copy.games.twenty48.title}`}
        roomId={id}
        full={board.full}
        honest={board.honest}
        initialShowCheated={showCheated}
        kingReward={GAME_KING_REWARD}
        kingLabel={copy.games.king.twenty48}
      />
    </div>
  );
}
```

- [ ] **Step 4: GameCard** — in `src/app/app/rooms/[id]/games/page.tsx`, add `twenty48Best` to the destructure — change:

```tsx
    wealth,
    flappyBest,
    tetrisBest,
  ] = await Promise.all([
```

to:

```tsx
    wealth,
    flappyBest,
    tetrisBest,
    twenty48Best,
  ] = await Promise.all([
```

and the fetch — change:

```tsx
    getMyBestScore(id, access.userId, "tetris"),
  ]);
```

to:

```tsx
    getMyBestScore(id, access.userId, "tetris"),
    getMyBestScore(id, access.userId, "2048"),
  ]);
```

Then add the card right after the Tetris `<GameCard … emoji="🧩" myBest={tetrisBest} />` (🔢 is Keno's, so 2048 uses 🧮):

```tsx
        <GameCard
          href={`/app/rooms/${id}/games/2048`}
          title={copy.games.twenty48.title}
          subtitle={copy.games.twenty48.subtitle}
          emoji="🧮"
          myBest={twenty48Best}
        />
```

- [ ] **Step 5: Gate** — `pnpm exec tsc --noEmit && pnpm lint`.

- [ ] **Step 6: Commit**

```bash
git add src/components/games/twenty48/twenty48-game.tsx "src/app/app/rooms/[id]/games/2048/page.tsx" src/lib/copy.ts "src/app/app/rooms/[id]/games/page.tsx"
git commit -m "feat(2048): playable 2048 with King leaderboard"
```

---

## Task 9: Full verification, migration & manual smoke

**Files:** docs only.

- [ ] **Step 1: Full gate** — `pnpm exec tsc --noEmit && pnpm lint && pnpm test` → all green. Ignore a `next/font` `pnpm build` failure (sandbox).

- [ ] **Step 2: Run the cron migration** — in the Supabase SQL editor, run `supabase/migrations/0050_game_kings.sql` (after 0047). Confirm `select cron.jobname from cron.job;` lists `game-kings-winter` / `game-kings-summer`.

- [ ] **Step 3: Manual smoke** — `pnpm dev`, open `/app/rooms/<id>/games`:
  - Grid shows 🐍 Snake, 🐤 Flappy, 🧩 Tetris, 🧮 2048 (+ existing cards).
  - **Snake/Flappy/Tetris/2048:** finish a run; the header balance rises by the
    per-game rate × events (Snake/Flappy `3×`, Tetris `8×`, 2048 `12 × (log2−1)`),
    and **stops at +250 within an hour** across these games combined (play several
    runs to confirm the shared cap).
  - **Each game page** shows its leaderboard with the correct crown label
    (Snake King / Flappy King / Tetris King / 2048 King; Pet Connect King on
    `/petconnect`).
  - Optionally run `select public.award_game_kings();` in SQL and confirm the top
    scorers gained 500 (idempotent on a second run).

- [ ] **Step 4: Docs** — tick the `todo.md` item if present; add one line to
  `CLAUDE.md`'s games section: skill games pay a per-game rate/event (Snake/Flappy
  3, Tetris 8, 2048 12) via `earnFromArcade` (shared 250/hour cap, server-side
  ref) and every skill game has a daily King (Snake 1000 / others 500, cron
  `0050`). Commit:

```bash
git add todo.md CLAUDE.md
git commit -m "docs: note arcade earning cap + per-game Kings"
```

---

## Self-Review

**Spec coverage:**
- Snake pays per apple every run (3/apple) → Task 3 (`earnFromArcade`). King 1000 preserved (0047 untouched). ✓
- Flappy: game untouched, earning unified to per-game rate + shared cap → Task 3 routes it; only its page gains King props (Task 4). ✓
- Tetris (8/line) → Tasks 5–6; 2048 (12 per tile via log2) → Tasks 7–8. ✓
- Per-game rates = `ARCADE_COINS_PER_EVENT` map (Task 1) baked into `arcadeCoins` (Task 2): Snake/Flappy 3, Tetris 8, 2048 12. ✓
- Shared 250/hour cap → `ARCADE_HOURLY_CAP` (renamed from `FLAPPY_HOURLY_CAP`, Task 3) + `cappedCoins` (Task 2) + ledger sum over `ARCADE_REASONS` in `earnFromArcade` (Task 3). ✓
- King for every skill game → Task 4 (Flappy/Tetris/2048/Pet Connect at 500, migration `0050`) + Snake 1000 unchanged; Tetris/2048 leaderboards in Tasks 6/8. ✓
- No client `runId`; Snake & Pet Connect clients untouched. ✓
- Only DB change = manual cron `0050` (0048/0049 already taken). ✓

**Placeholder scan:** none — every code step is complete. ✓

**Type consistency:**
- `arcadeCoins(gameKey, score)` & `cappedCoins(desired, earned, cap)` defined Task 2, used Task 3. ✓
- `earnFromArcade(userId, gameKey, score, cheated)` defined Task 3, called with that arity in `games.ts`. ✓
- `KingBadge({ reward, label })` (Task 4) used by `Leaderboard` with `label={kingLabel ?? copy.games.king.snake}`; `copy.games.king.{snake,flappy,tetris,twenty48,petconnect}` all defined in Task 4. ✓
- `GAME_KING_REWARD` defined Task 4, imported by Flappy/Pet Connect (Task 4) and Tetris/2048 pages (Tasks 6/8). ✓
- Tetris client uses `COLS/ROWS/PIECE_ID/cellsOf/createInitialState/hardDrop/moveLeft/moveRight/rotate/softDrop/tick/TetrisState`; 2048 client uses `createInitialState/move/Direction/Game2048State` — all exported in their engine task. ✓
- Task ordering keeps each step `tsc`-clean: `snakeBestPerPoint`/`flappyBestPerPoint` removed in Task 3 alongside their functions; new keys added before use. ✓

**Untouched-by-contract:** Flappy game/engine, Keno, Snake/Pet Connect clients, Snake King 0047. Flappy & Pet Connect *pages* gain only King props. ✓
