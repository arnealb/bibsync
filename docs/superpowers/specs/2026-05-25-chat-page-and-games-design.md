# Design — dedicated chat page + games library (Snake)

- **Status:** approved (brainstorming) — ready for implementation plan
- **Date:** 2026-05-25
- **Branch:** `feat/chat-page-and-games` (new branch, not main)

## 1. Goal

Two user-facing changes to BibSync:

1. **Move chat off the room dashboard** into its own dedicated page per room
   (`/app/rooms/[id]/chat`). Keep the existing per-room scoping, RLS, and
   realtime — only the surfacing changes.
2. **Add a games library per room** at `/app/rooms/[id]/games`, with Snake as
   the first game (`/app/rooms/[id]/games/snake`). Each game persists scores
   per-user-per-room, with a per-game leaderboard. No room-wide totals in v1.

Navigation is unified by **sub-tabs inside the room** (Overzicht / Chat /
Eten / Games), which replaces the existing mobile tab-bar in
`room-dashboard.tsx` and the "Eten" button in `RoomActions`.

## 2. Out of scope

- Room-wide aggregate score / cross-game ranking.
- Multiplayer or realtime gameplay (Snake is single-player, score-only).
- Mobile touch / swipe controls for Snake — mobile users see a "use desktop"
  message.
- Anti-cheat / server-side game simulation (score is client-reported; a
  sanity cap prevents accidental garbage, not determined cheaters).
- Adding chat to the global app-header (chat stays per-room).
- Realtime updates on the leaderboard (manual refresh via `revalidatePath`
  after each submit is enough; realtime can be added later via the existing
  `use-*-realtime.ts` pattern).

## 3. Architecture

### 3.1 Routes (App Router, Next 16)

```
src/app/app/rooms/[id]/
├── layout.tsx          NEW   — room access check + RoomPageHeader + RoomTabs
├── page.tsx            EDIT  — "Overzicht": proposals + presence; chat-slot removed
├── chat/page.tsx       NEW   — full-height ChatPanel
├── eten/page.tsx       EDIT  — remove h1/ArrowLeft (now in layout)
├── games/
│   ├── page.tsx        NEW   — GamesLibrary + Snake leaderboard
│   └── snake/page.tsx  NEW   — server wrapper around <SnakeGame>
└── settings/page.tsx   UNCHANGED  — owner-only, not in tab bar
```

The shared layout calls `requireRoomAccess(id)` exactly once (it currently
happens per-page) and passes the room context implicitly via re-fetch in
each page where needed. Pages remain independent server components so each
can fetch its own slice (proposals, messages, etc.) — the layout is for
chrome (header + tabs), not data.

### 3.2 Components

| File | Type | Purpose |
| --- | --- | --- |
| `src/components/rooms/room-tabs.tsx` | `"use client"` | `Link`s to the 4 tabs, active state via `usePathname()`. |
| `src/components/rooms/room-page-header.tsx` | server | h1 + description + member count + `RoomActions`. Replaces the inline header in `room-dashboard.tsx` and `eten/page.tsx`. |
| `src/components/rooms/room-dashboard.tsx` | EDIT | Shrinks to "Overzicht" content only: proposals + presence-sidebar. Mobile tab-bar removed. Chat slot removed. |
| `src/components/rooms/room-actions.tsx` | EDIT | Remove "Eten" button (now a tab). Keep settings/leave/copy-code. |
| `src/components/games/games-library.tsx` | server | Grid of `<GameCard>` items. |
| `src/components/games/game-card.tsx` | server | Per-game card: name, description, "Speel" link, current user's best. |
| `src/components/games/leaderboard.tsx` | server | Top-10 list per game, joined with `profiles`. |
| `src/components/games/snake/snake-game.tsx` | `"use client"` | Canvas + RAF loop; submits score on game-over via server action. |
| `src/app/app/rooms/[id]/chat/page.tsx` | server | Re-fetches access, members, and messages; renders `<ChatPanel>` full-height. Mirrors the props shape currently used in `room/[id]/page.tsx`. |

### 3.3 New library code

| File | Purpose |
| --- | --- |
| `src/lib/games/snake/engine.ts` | Pure state machine: `createInitialState`, `applyInput`, `tick`, `nextSpeedMs`. No DOM, no globals. Seeded RNG. |
| `src/lib/games/queries.ts` | `getRoomLeaderboard(roomId, gameKey)`, `getMyBestScore(roomId, userId, gameKey)`. |
| `src/lib/validation/games.ts` | `gameKeySchema = z.enum(['snake'])`; `submitScoreSchema`. |
| `src/app/_actions/games.ts` | `submitGameScore({ roomId, gameKey, score })` server action. |

### 3.4 Copy additions (`src/lib/copy.ts`)

```ts
rooms.tabs = {
  overview: "Overzicht",
  chat: "Chat",
  food: "Eten",
  games: "Games",
};

games = {
  nav: "Games",
  title: "Spelletjes",
  subtitle: "Speel tegen je medestudenten",
  yourBest: "Jouw beste",
  noBest: "—",
  leaderboard: "Leaderboard",
  noScores: "Nog niemand heeft gespeeld",
  play: "Speel",
  snake: {
    title: "Snake",
    subtitle: "Klassiek — pijltjes om te draaien",
    score: "Score",
    gameOver: "Game over",
    restart: "Opnieuw",
    newHighScore: "Nieuwe high score!",
    saved: (n: number) => `Score ${n} opgeslagen`,
    mobileBlocked: "Snake is enkel speelbaar op desktop — kom terug op een laptop.",
  },
};
```

Existing `copy.rooms.chatPlaceholder` and `copy.rooms.tabs` references in
`room-dashboard.tsx` need updates.

## 4. Data model

### 4.1 Migration `supabase/migrations/0007_game_scores.sql`

```sql
create table public.game_scores (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  game_key text not null,
  score integer not null check (score >= 0),
  created_at timestamptz not null default now()
);

create index game_scores_room_game_score_idx
  on public.game_scores (room_id, game_key, score desc);
create index game_scores_user_idx
  on public.game_scores (user_id);

alter table public.game_scores enable row level security;

create policy "game_scores_select_member"
  on public.game_scores for select
  using (is_room_member(room_id));

create policy "game_scores_insert_self"
  on public.game_scores for insert
  with check (user_id = auth.uid() and is_room_member(room_id));

create policy "game_scores_select_admin"
  on public.game_scores for select using (is_admin());

create policy "game_scores_delete_admin"
  on public.game_scores for delete using (is_admin());
```

**Design choice — insert-only, not upsert:** Storing all runs makes the
leaderboard query (`max(score) per user`) trivial, and gives us "games
played" for free. The downside (table grows over time) is bounded by human
play volume and easy to prune later.

**Realtime is NOT enabled** for `game_scores` in v1. After a successful
submit, the server action calls `revalidatePath` on the games index, which
causes the leaderboard server component to refetch on the next visit.

### 4.2 Type addition (`src/types/database.ts`)

Add `game_scores: { Row, Insert, Update }` following the existing shape.
The Row maps every column; `Insert` makes `id` and `created_at` optional.

### 4.3 Server action contract

```ts
// src/app/_actions/games.ts
"use server";
export async function submitGameScore(
  input: { roomId: string; gameKey: 'snake'; score: number }
): Promise<ActionResult> {
  // 1. submitScoreSchema.safeParse(input)
  // 2. const access = await requireRoomAccess(input.roomId); if (!access) return { ok: false, error: copy.rooms.notMember };
  // 3. supabase.from('game_scores').insert({ room_id, user_id: access.userId, game_key, score });
  // 4. revalidatePath(`/app/rooms/${input.roomId}/games`);
  //    revalidatePath(`/app/rooms/${input.roomId}/games/snake`);
  // 5. return { ok: true };
}
```

### 4.4 Query contracts

```ts
// src/lib/games/queries.ts
export type LeaderboardEntry = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  bestScore: number;
};

export async function getRoomLeaderboard(
  roomId: string,
  gameKey: 'snake',
  limit = 10
): Promise<LeaderboardEntry[]>;

export async function getMyBestScore(
  roomId: string,
  userId: string,
  gameKey: 'snake'
): Promise<number | null>;
```

Implemented via PostgREST: a single `select` of all `(user_id, score)` rows
for that `(roomId, gameKey)`, then reduced in JS to `max(score) per user`
and joined with the existing `MemberMap` from `getRoomMembers`. Expected
volumes per room are tiny (dozens to hundreds of rows). If we ever outgrow
this we add a `room_game_leaderboard` SQL view + RPC.

## 5. Snake game logic

### 5.1 Engine (`src/lib/games/snake/engine.ts`)

Pure functions, no DOM, no React. Testable end-to-end in Vitest.

```ts
export const GRID = 20;

export type Direction = 'up' | 'down' | 'left' | 'right';
export type Cell = { x: number; y: number };

export type SnakeState = {
  snake: Cell[];          // index 0 = head
  food: Cell;
  dir: Direction;
  pendingDir: Direction;  // 1-deep input buffer, applied at next tick
  score: number;
  gameOver: boolean;
  tickCount: number;
  rngSeed: number;        // mutable across ticks via xorshift
};

export function createInitialState(seed: number): SnakeState;
export function applyInput(state: SnakeState, dir: Direction): SnakeState;
export function tick(state: SnakeState): SnakeState;
export function nextSpeedMs(score: number): number;  // 160 → 80, step every 5 apples
```

**Rules:**
- Eating food: snake grows by 1 segment, score += 1, new food at a random
  free cell using the seeded RNG.
- Wall or self collision: `gameOver = true`. State otherwise unchanged.
- `applyInput` rejects 180° flips (snake can't fold onto itself).
- `pendingDir` lets the player queue the next turn between ticks so fast
  inputs aren't lost.
- RNG: simple xorshift32 in pure form, returns an updated seed.

### 5.2 Component (`src/components/games/snake/snake-game.tsx`)

```tsx
"use client";
export function SnakeGame({ roomId, myBest }: { roomId: string; myBest: number | null }) {
  // 1. On mount, detect mobile via window.matchMedia('(pointer: coarse)').
  //    If mobile → render copy.games.snake.mobileBlocked message, no game.
  // 2. useState<SnakeState>(createInitialState(Date.now())).
  // 3. useEffect: window.addEventListener('keydown') → applyInput.
  //    Arrow keys + WASD. Prevent default to avoid page scroll.
  // 4. useEffect: setInterval with nextSpeedMs(score) → dispatch tick.
  //    Clear and restart the interval whenever the score changes (speed-up).
  // 5. useEffect on state change: draw canvas (grid lines, snake cells, food).
  // 6. On gameOver: if score > 0 → submitGameScore (server action).
  //    Toast: copy.games.snake.newHighScore if score > (myBest ?? 0),
  //    else copy.games.snake.saved(score).
  // 7. "Opnieuw" button: setState(createInitialState(Date.now())).
}
```

The canvas is fixed at `CELL_SIZE × GRID` pixels per axis (CELL_SIZE = 24 →
480×480). Score and "Opnieuw" sit above the canvas. No extra UI chrome.

## 6. Testing

### 6.1 Vitest unit tests

`src/lib/games/snake/engine.test.ts`:
- `tick` moves the head one cell in `dir`.
- Eating food: snake length +1, score +1, new food placed at a free cell.
- Wall collision sets `gameOver`.
- Self collision sets `gameOver`.
- `applyInput` rejects 180° (e.g. moving right then pressing left).
- `pendingDir` is consumed and replaces `dir` on the next tick.
- Seeded RNG: two identical seeds produce identical food placements.
- `nextSpeedMs(0) > nextSpeedMs(20)`, and the result is clamped at ≥ 80ms.

`src/lib/games/scoring.test.ts` (if there is non-trivial JS-side reduce
logic in the leaderboard query): `max(score) per user`, ties broken by
earlier `created_at`.

### 6.2 Playwright smoke

`tests/e2e/games.spec.ts`:
- Unauthenticated request to `/app/rooms/<id>/games` redirects to `/login`.
- Same for `/games/snake` and `/chat`.

Deeper authed flows (submit a score, leaderboard updates) require a seeded
auth account; that is out of scope for v1 per the existing pattern in
`todo.md` for the e2e suite.

### 6.3 Manual verification before declaring done

Per `superpowers:verification-before-completion`:
- `pnpm dev`, log in, open a room.
- All 4 tabs render and are reachable from each other.
- Eten still works (no regression).
- Snake plays on desktop, score increases on apple, dies on wall and self.
- After game-over, leaderboard on `/games` shows the new entry (after a
  manual refresh — `revalidatePath` triggers a re-render on next nav).
- Mobile width: Snake page shows the desktop-only message.

## 7. Branching & migration

- New branch: `feat/chat-page-and-games`. Branch off `main`.
- Migration `0007_game_scores.sql` is run manually in the Supabase SQL
  Editor (matches existing convention).
- `pnpm build`, `pnpm lint`, `pnpm test`, `pnpm test:e2e` must all be clean
  before merge.

## 8. Risk register

- **RLS recursion**: avoided — policies use `is_room_member(room_id)`,
  consistent with the rest of the schema. No `game_scores` policy queries
  `game_scores`.
- **Client-side score reporting**: a player can forge a score. Mitigation:
  sanity cap at 100k (Snake on a 20×20 grid has a hard maximum of 399). Not
  a true anti-cheat — acceptable for a social study app.
- **Layout-level access check vs page-level**: moving `requireRoomAccess` to
  the layout means each child page no longer enforces it. Pages still need
  to fetch the access object for the user id. Decision: keep page-level
  calls — layout does it for the header, pages do it for the data. Slight
  duplication is cheaper than a context plumbing layer.
- **Breaking the existing dashboard**: the chat panel and "Eten" button
  disappear from places people might be used to. Risk is low (small user
  base), and the new tab bar surfaces both more prominently.
