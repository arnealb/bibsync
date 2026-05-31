# Snake King — design

**Date:** 2026-05-31
**Status:** approved (brainstorming)

## Summary

Replace the existing **"Snake master"** daily reward (75 bibcoins/day, bare 👑 in
the leaderboard, added in migration `0044`) with **"Snake King"**:

- The reigning #1 honest Snake-score holder in a room is the **Snake King**.
- The King earns **1000 bibcoins/day**, paid by a daily `pg_cron` job just after
  Brussels midnight (idempotent per room+day) — same mechanism as before, only
  the amount and naming change.
- A polished gold **"Snake King" badge** (crown + label) replaces the bare 👑,
  shown **only in the Snake leaderboard** (no sidebar, no chat), on the #1 row of
  the honest view.

## Key decisions (from brainstorming)

1. **Replace, don't coexist.** "Snake master" (75/day) is fully removed — no
   double reward, no second badge.
2. **King status is instant, record-based — NOT midnight-gated.** The King is
   simply the current #1 honest scorer (`honest[0]`). Because `submitGameScore`
   already calls `revalidatePath` on `/games` and `/games/snake`, the leaderboard
   re-renders the moment a game ends, so a player who takes the record shows as
   Snake King immediately — no refresh, no waiting for midnight. The midnight
   cron does **only the coin payout**, never the title.
3. **Leaderboard only.** The badge appears on the Snake leaderboard (rendered on
   both the Snake game page and the games hub). Not in the presence sidebar, not
   in chat.

## Components & data flow

### 1. Reward — migration `0047_snake_king.sql`

> Numbered `0047` because the latest migration after a teammate merge is
> `0046_food_bets.sql`.

- `do $$ ... cron.unschedule('snake-master-winter'/'snake-master-summer') ... $$`
  wrapped in exception-swallowing blocks (mirror `0044`).
- `drop function if exists public.award_snake_masters();`
- `create or replace function public.award_snake_kings()` — identical body to the
  old function except it pays **1000** and uses ledger source **`'snake_king'`**.
  Idempotent per `(room_id, Brussels date)` via `award_bibcoins`. Ties → earliest
  record holder (`order by room_id, score desc, created_at asc`).
- `revoke execute ... from public, authenticated; grant execute ... to service_role;`
- Reschedule `snake-king-winter` (`1 23 * * *`) and `snake-king-summer`
  (`1 22 * * *`) → both resolve to ~00:01 Brussels across DST; per-day
  idempotency makes the second run a no-op.
- Comment in the migration notes that the `1000` must stay in sync with
  `SNAKE_KING_REWARD` in the app.

No schema changes (no new tables/columns) → `src/types/database.ts` untouched.

### 2. Badge — `src/components/games/snake-king-badge.tsx`

- Client-safe, self-contained. Renders a gold pill: lucide `Crown` icon + the
  text "Snake King".
- Style: `bg-gradient-to-r from-amber-300 to-yellow-500`, `text-amber-950`,
  `ring-1 ring-amber-400/50`, rounded-full, small (`text-[10px] font-bold`),
  subtle shadow. Reuse the existing `fx-gold` shine class on the label for a
  tasteful gleam (consistent with the cosmetic name-effects).
- Tooltip / aria-label: `copy.games.snakeKing.tooltip` →
  `Snake King · +1000 bibcoins/dag 👑`.

### 3. Reward constant

- `SNAKE_KING_REWARD = 1000` exported from a client-safe module
  (`src/lib/games/constants.ts`), imported by both pages and used to build the
  tooltip. Single source of truth in the app; migration hardcodes the same value
  with a sync comment.

### 4. Wiring — `Leaderboard`

- `src/components/games/leaderboard.tsx`: drop the `masterReward` prop and its
  `index === 0` 👑 block; add `kingReward?: number`. When `kingReward != null`,
  not showing cheated, and `index === 0`, render `<SnakeKingBadge />` instead of
  the bare crown.
- `src/app/app/rooms/[id]/games/page.tsx`: replace `masterReward={75}` with
  `kingReward={SNAKE_KING_REWARD}`.
- `src/app/app/rooms/[id]/games/snake/page.tsx`: pass
  `kingReward={SNAKE_KING_REWARD}` (the Snake page leaderboard currently passes
  nothing, so the badge now shows there too — this is the primary place a player
  sees themselves crowned right after a game).

### 5. Copy — `src/lib/copy.ts`

- Remove `snakeMaster: (n) => ...`.
- Add `snakeKing: { label: "Snake King", tooltip: (n) => \`Snake King · +${n} bibcoins/dag 👑\` }`
  (or a fixed string if the number is sourced from the constant — keep it a
  function of `n` so the tooltip stays in sync with `SNAKE_KING_REWARD`).

## Edge cases

- **Ties on top honest score:** the displayed badge sits on `honest[0]` (Map
  insertion order); the cron pays "earliest record holder". On an exact score tie
  these can differ — accepted as a rare, low-impact mismatch; not worth extra
  complexity.
- **Cheated view (`showCheated`):** badge is suppressed, exactly like the old 👑,
  because the cheated ranking can put a non-honest run at #1.
- **Empty leaderboard:** no honest entries → no badge (existing empty-state path).
- **Other viewers:** a second viewer's already-rendered leaderboard won't live
  update when someone else takes the record (no realtime subscription added). The
  requirement was "instant when *you* take the record", which `revalidatePath`
  satisfies for the actor. Realtime for spectators is explicitly out of scope.

## Out of scope (YAGNI)

- Presence sidebar / chat display of the King.
- Global or cross-room King.
- Realtime leaderboard updates for spectators.
- Configurable reward amount (1000 is fixed).

## Verification

Pure-SQL cron + UI/wiring — no pure engine to TDD. Verify with:

- `pnpm exec tsc --noEmit`
- `pnpm lint`
- `pnpm test`

(Local `pnpm build` may fail on `next/font` per CLAUDE.md; rely on Vercel for the
real build.) The migration is run manually in the Supabase SQL editor.
