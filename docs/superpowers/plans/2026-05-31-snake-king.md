# Snake King Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the "Snake master" daily reward (75 bibcoins/day) with "Snake King" — the reigning #1 honest Snake scorer earns 1000 bibcoins/day and shows a gold crown badge in the Snake leaderboard.

**Architecture:** A `pg_cron` job pays the daily 1000-coin reward (replacing the old job). The King *title/badge* is purely the current `honest[0]` leaderboard entry — instant and record-based, recomputed on every server render (and `submitGameScore` already revalidates the leaderboard paths, so a player is crowned the moment their game ends). A new presentational `SnakeKingBadge` replaces the bare 👑, gated to the honest view's #1 row, wired through a `kingReward` prop on the existing `Leaderboard`.

**Tech Stack:** Next.js 16 (App Router, Server Components), TypeScript, Tailwind v4, lucide-react, Supabase Postgres + `pg_cron`.

**Spec:** `docs/superpowers/specs/2026-05-31-snake-king-design.md`

**Note on TDD:** This feature has no new pure logic to unit-test — it is a SQL cron migration, a presentational badge, copy strings, and prop wiring. The King is literally `honest[0]` (array indexing already computed by `getRoomLeaderboard`). Verification is therefore: the existing test suite stays green + `tsc` + `lint`. No new unit tests are written, because testing `arr[0]` or a static gradient pill would be noise.

---

### Task 1: Reward migration `0047_snake_king.sql`

Replaces the old `award_snake_masters` cron with `award_snake_kings` paying 1000. Numbered 0047 because `0046_food_bets.sql` is the latest after a teammate merge.

**Files:**
- Create: `supabase/migrations/0047_snake_king.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0047_snake_king.sql` with exactly:

```sql
-- ============================================================================
-- BibSync — daily "Snake King" reward (replaces "Snake master", migration 0044).
-- Each day just after Brussels midnight, the player holding the highest HONEST
-- snake score in a room gets 1000 bibcoins. Idempotent per (room, Brussels date)
-- via the award_bibcoins ledger, so it can run more than once without paying
-- twice. Two UTC cron times (22:01 / 23:01) cover both DST offsets so the award
-- lands right after Brussels midnight. Requires pg_cron.
--
-- The King *title/badge* in the app is computed live from the leaderboard
-- (honest #1), not by this job — this job only pays out.
--
-- NOTE: the 1000 below must stay in sync with SNAKE_KING_REWARD in
-- src/lib/games/constants.ts.
-- ============================================================================

create extension if not exists pg_cron;

-- Retire the old "Snake master" job + function.
do $$
begin
  perform cron.unschedule('snake-master-winter');
exception when others then null;
end $$;
do $$
begin
  perform cron.unschedule('snake-master-summer');
exception when others then null;
end $$;

drop function if exists public.award_snake_masters();

create or replace function public.award_snake_kings()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _today date := (now() at time zone 'Europe/Brussels')::date;
  _rec   record;
begin
  for _rec in
    select distinct on (room_id) room_id, user_id
    from public.game_scores
    where game_key = 'snake' and not cheated
    order by room_id, score desc, created_at asc -- ties: earliest record holder
  loop
    perform public.award_bibcoins(
      _rec.user_id,
      1000,
      'snake_king',
      _rec.room_id::text || ':' || _today::text
    );
  end loop;
end;
$$;

revoke execute on function public.award_snake_kings() from public, authenticated;
grant execute on function public.award_snake_kings() to service_role;

-- (Re)schedule the daily job(s). Both UTC times resolve to ~00:01 Brussels
-- across DST; the per-day idempotency makes the second run a no-op.
do $$
begin
  perform cron.unschedule('snake-king-winter');
exception when others then null;
end $$;
do $$
begin
  perform cron.unschedule('snake-king-summer');
exception when others then null;
end $$;

select cron.schedule('snake-king-winter', '1 23 * * *',
  $$select public.award_snake_kings()$$);
select cron.schedule('snake-king-summer', '1 22 * * *',
  $$select public.award_snake_kings()$$);
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/0047_snake_king.sql
git commit -m "feat(snake): Snake King daily reward — 1000 bibcoins/day (migration 0047)"
```

> The migration is run manually in the Supabase SQL editor (per CLAUDE.md). Not part of `pnpm build`/`lint`.

---

### Task 2: Reward constant + copy

**Files:**
- Create: `src/lib/games/constants.ts`
- Modify: `src/lib/copy.ts:897`

- [ ] **Step 1: Create the constant**

Create `src/lib/games/constants.ts` with exactly:

```ts
/**
 * Daily bibcoins paid to the reigning Snake King (the room's top HONEST snake
 * score). Keep in sync with the 1000 in supabase/migrations/0047_snake_king.sql.
 */
export const SNAKE_KING_REWARD = 1000;
```

- [ ] **Step 2: Replace the copy string**

In `src/lib/copy.ts`, replace this line (currently line 897):

```ts
    snakeMaster: (n: number) => `Snake master · +${n} bibcoins/dag 👑`,
```

with:

```ts
    snakeKing: {
      label: "Snake King",
      tooltip: (n: number) => `Snake King · +${n} bibcoins/dag 👑`,
    },
```

- [ ] **Step 3: Verify it compiles**

Run: `pnpm exec tsc --noEmit`
Expected: FAIL — `src/components/games/leaderboard.tsx` still references `copy.games.snakeMaster` (fixed in Task 4). This confirms the only remaining references are the ones we rewrite next. (If other unrelated errors appear, stop and investigate.)

- [ ] **Step 4: Commit**

```bash
git add src/lib/games/constants.ts src/lib/copy.ts
git commit -m "feat(snake): SNAKE_KING_REWARD constant + Snake King copy"
```

---

### Task 3: `SnakeKingBadge` component

A gold gradient pill with a filled crown + "Snake King". Presentational, no state.

**Files:**
- Create: `src/components/games/snake-king-badge.tsx`

- [ ] **Step 1: Write the component**

Create `src/components/games/snake-king-badge.tsx` with exactly:

```tsx
import { Crown } from "lucide-react";

import { copy } from "@/lib/copy";
import { cn } from "@/lib/utils";

/**
 * Gold "Snake King" badge for the reigning #1 honest Snake scorer. Shown only
 * in the Snake leaderboard. `reward` is the daily bibcoins payout, used in the
 * tooltip (kept in sync with the cron in 0047_snake_king.sql).
 */
export function SnakeKingBadge({
  reward,
  className,
}: {
  reward: number;
  className?: string;
}) {
  const label = copy.games.snakeKing.tooltip(reward);
  return (
    <span
      title={label}
      aria-label={label}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full bg-gradient-to-r from-amber-300 to-yellow-500 px-1.5 py-0.5 text-[10px] font-bold text-amber-950 shadow-sm ring-1 ring-amber-500/40",
        className,
      )}
    >
      <Crown className="size-3 fill-amber-950" aria-hidden />
      {copy.games.snakeKing.label}
    </span>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm exec tsc --noEmit`
Expected: still FAIL only on `leaderboard.tsx`'s `snakeMaster` reference (Task 4). No new errors from this file.

- [ ] **Step 3: Commit**

```bash
git add src/components/games/snake-king-badge.tsx
git commit -m "feat(snake): SnakeKingBadge gold crown component"
```

---

### Task 4: Wire the badge into the leaderboard + both pages

Swap `masterReward` (bare 👑) for `kingReward` (badge) and pass it on both pages.

**Files:**
- Modify: `src/components/games/leaderboard.tsx`
- Modify: `src/app/app/rooms/[id]/games/page.tsx:149`
- Modify: `src/app/app/rooms/[id]/games/snake/page.tsx`

- [ ] **Step 1: Update `Leaderboard` — import the badge**

In `src/components/games/leaderboard.tsx`, add to the imports (after the `ProfileLink` import block, keeping alphabetical-ish grouping):

```tsx
import { SnakeKingBadge } from "@/components/games/snake-king-badge";
```

- [ ] **Step 2: Update `Leaderboard` — rename the prop**

In the `LeaderboardProps` interface, replace:

```tsx
  /** If set, the honest #1 is the daily "master" earning this many coins/day. */
  masterReward?: number;
```

with:

```tsx
  /** If set, the honest #1 is the daily Snake King earning this many coins/day. */
  kingReward?: number;
```

And in the destructured params, replace `masterReward,` with `kingReward,`.

- [ ] **Step 3: Update `Leaderboard` — swap the crown for the badge**

Replace this block:

```tsx
                {masterReward != null && !showCheated && index === 0 && (
                  <span
                    title={copy.games.snakeMaster(masterReward)}
                    aria-label={copy.games.snakeMaster(masterReward)}
                  >
                    👑
                  </span>
                )}
```

with:

```tsx
                {kingReward != null && !showCheated && index === 0 && (
                  <SnakeKingBadge reward={kingReward} />
                )}
```

- [ ] **Step 4: Update the games hub page**

In `src/app/app/rooms/[id]/games/page.tsx`, add the import near the other `@/lib` imports:

```tsx
import { SNAKE_KING_REWARD } from "@/lib/games/constants";
```

Then replace `masterReward={75}` (line ~149) with:

```tsx
        kingReward={SNAKE_KING_REWARD}
```

- [ ] **Step 5: Update the Snake game page**

In `src/app/app/rooms/[id]/games/snake/page.tsx`, add the import near the other `@/lib` imports:

```tsx
import { SNAKE_KING_REWARD } from "@/lib/games/constants";
```

Then add the prop to the `<Leaderboard ... />` element (it currently passes `title`, `roomId`, `full`, `honest`, `initialShowCheated`):

```tsx
        kingReward={SNAKE_KING_REWARD}
```

- [ ] **Step 6: Verify the whole thing compiles + lints**

Run: `pnpm exec tsc --noEmit`
Expected: PASS (no more `snakeMaster`/`masterReward` references).

Run: `pnpm lint`
Expected: PASS (no new warnings/errors).

- [ ] **Step 7: Commit**

```bash
git add src/components/games/leaderboard.tsx "src/app/app/rooms/[id]/games/page.tsx" "src/app/app/rooms/[id]/games/snake/page.tsx"
git commit -m "feat(snake): show Snake King badge in the leaderboard, drop Snake master"
```

---

### Task 5: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Confirm no stale references remain**

Run: `git grep -n "snakeMaster\|masterReward\|award_snake_masters" -- src`
Expected: no output (the only `award_snake_masters` left is in historical migration `0044`, which is immutable — `-- src` excludes it).

- [ ] **Step 2: Type-check, lint, test**

Run: `pnpm exec tsc --noEmit`
Expected: PASS

Run: `pnpm lint`
Expected: PASS

Run: `pnpm test`
Expected: PASS (existing suite unaffected)

- [ ] **Step 3: Manual DB step (human)**

Run `supabase/migrations/0047_snake_king.sql` in the Supabase SQL editor. Confirm `cron.job` lists `snake-king-winter` / `snake-king-summer` and no longer lists `snake-master-*`.

---

## Self-Review

**Spec coverage:**
- Replace "Snake master" → Task 1 (drops fn + cron, source `snake_king`) + Task 4 (drops `masterReward`/👑) + Task 2 (drops `snakeMaster` copy). ✓
- 1000 bibcoins/day via cron → Task 1. ✓
- King = instant, record-based (`honest[0]`, not midnight) → no code needed beyond keeping the badge on `honest[0]`; `revalidatePath` in `submitGameScore` (unchanged) makes it instant. Documented in plan header. ✓
- Gold crown badge, leaderboard only → Task 3 (badge) + Task 4 (wired on `index === 0`, honest view only; both leaderboard pages, no sidebar/chat). ✓
- Migration `0047` → Task 1. ✓
- `SNAKE_KING_REWARD` single source + tooltip sync → Task 2. ✓

**Placeholder scan:** No TBD/TODO; every code step shows full code. ✓

**Type consistency:** Prop renamed `masterReward` → `kingReward` consistently across interface, destructure, JSX, and both call sites. `copy.games.snakeKing.{label,tooltip}` used consistently in the badge. `SnakeKingBadge` takes `{ reward: number; className?: string }` and is called as `<SnakeKingBadge reward={kingReward} />`. ✓

**Deviation from spec:** Spec suggested a subtle `fx-gold` shine on the label. `.fx-gold` sets `color: transparent` (clips a gradient to text), which would be unreadable on a gold pill. The plan instead uses a solid gold-gradient pill with dark `text-amber-950` + filled crown — more readable, still premium. Noted intentionally.
