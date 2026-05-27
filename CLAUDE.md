# CLAUDE.md — BibSync

Guidance for Claude Code (and humans) working in this repo.

## What this is

**BibSync** — a group-coordination web app for students studying together in
the library. Create a room, propose breaks and vote on them (with a destination
/ walk + a map-drawn route), see who's studying/on a break in realtime, and chat
per room (with GIFs, emoji reactions and photos). It has grown a **bibcoins**
economy (global per-user currency + cosmetics) funding a **Games** library
(Snake, multiplayer poker/blackjack/roulette, Pet Connect) and a **Stappen**
(steps) feature that compares daily step totals. Dutch UI.

> **Roadmap:** see [`todo.md`](todo.md) for the prioritised feature list — work
> the item marked _in progress_, then take the next unchecked item in order.

## Stack & environment

- **Next.js 16** (App Router, TypeScript `strict`, Server Actions, React 19).
- **Tailwind CSS v4** + **shadcn/ui** using the **`base-nova`** style, which is
  built on **`@base-ui/react`** (NOT Radix). Consequences:
  - Polymorphism uses the **`render` prop**, not `asChild`:
    `<Button render={<Link href="/x" />} nativeButton={false}>…</Button>`.
    Set `nativeButton={false}` whenever `render` is an `<a>`/Link.
  - `Select`/`DropdownMenu`/`Dialog` triggers/items take `render`; base-ui
    `Select.onValueChange` passes `string | null` (coerce nulls).
- **Supabase** (Postgres + RLS + Realtime + Auth) via `@supabase/ssr`, using the
  **new publishable key naming** `sb_publishable_*` (drop-in for the legacy anon
  key). Service/secret key (`sb_secret_*`) is only used by the seed script.
- Zod, date-fns (+`@date-fns/tz`), sonner, lucide-react, next-themes.
- **pnpm** — pinned to `pnpm@9.15.9` via `packageManager` (Node here is 21;
  pnpm 11 needs Node 22+). Corepack's bundled pnpm is broken on this Node.

## Commands

- `pnpm dev` · `pnpm build` · `pnpm start` · `pnpm lint`
- `pnpm seed` — demo data; needs `SUPABASE_SECRET_KEY`, skips gracefully without.
- Before considering work done: `pnpm build` **and** `pnpm lint` must be clean.

## Conventions (follow these)

- **Server Actions** live in `src/app/_actions/`. Each: Zod-parse → Supabase
  mutate → `revalidatePath` where needed → return `ActionResult`
  (`{ ok: true } | { ok: false; error }`) or a specialised result. A
  `"use server"` file may only export async functions — keep shared
  types/consts elsewhere (e.g. `_actions/types.ts`, `_actions/auth-types.ts`).
- **Validation:** Zod schemas in `src/lib/validation/`. Never trust the client;
  re-validate in the action even when the client already did.
- **UI copy:** all Dutch user-facing strings in `src/lib/copy.ts`. Code and
  comments in English. No hardcoded UI strings in components.
- **Time:** `src/lib/time.ts` — Europe/Brussels, 24h, `nl` locale. Use these
  helpers, don't format dates ad-hoc.
- **Errors:** `console.error` with context server-side; friendly Dutch message
  to the user (toast or inline). No `console.log`/TODO in app code.
- **Components:** small (≤~150 lines), client components only when needed
  (`"use client"`). Server components fetch; client components subscribe/mutate.
- **Immutability:** never mutate state/objects in place; build new ones.
- **Imports into client components** must stay client-safe. `getInitials` lives
  in `src/lib/initials.ts` (NOT `lib/auth.ts`, which pulls in the server-only
  Supabase client).

## Supabase clients

- `src/lib/supabase/server.ts` — Server Components / Actions / Route Handlers.
- `src/lib/supabase/client.ts` — browser (and Realtime).
- `src/lib/supabase/middleware.ts` — `updateSession`, called from
  **`src/proxy.ts`** (Next 16 renamed the `middleware` convention to `proxy`).
  `proxy.ts` refreshes the session and guards `/app/*`.

## Data model & RLS

Migrations in `supabase/migrations/` are run **manually** in the Supabase SQL
Editor, in order:

1. `0001_init.sql` — tables (`profiles`, `rooms`, `room_members`,
   `break_proposals`, `votes`, `presence`, `messages`), RLS, the new-user →
   profile trigger, indexes, and the realtime publication.
2. `0002_join_room.sql` — `join_room(code)` RPC (joining needs to look up a room
   you're not yet a member of, which RLS blocks).
3. `0003_admin.sql` — `profiles.is_admin`, `is_admin()`, admin RLS policies.
4. `0004_proposal_comments.sql` — comments on proposals (`proposal_comments`,
   with `room_id` denormalised), RLS, realtime, `replica identity full`.
5. `0005_food.sql` — food voting (`food_proposals`/`food_votes`/`food_comments`
   + `can_access_food()`), its own parallel stack on `/app/rooms/[id]/eten`.
   Reuses the calendar bar, generic comments component and joke vote-weight.
6. `0006_avatars.sql` — public `avatars` Storage bucket + policies. Avatars are
   uploaded client-side, set via `updateAvatar`, rendered with `UserAvatar`.
   Member data flows as `MemberMap` (`Record<id,{name,avatarUrl}>`), see
   `src/lib/members.ts`.

Later migrations (run in order; **`0012`/`0013` were renumbered away** during a
teammate merge, so the sequence jumps `0011 → 0014`):

7. `0007_food_time.sql` — time slot on food proposals.
8. `0008_push.sql` / `0009_push_prefs.sql` — Web Push subscriptions + per-user
   `notify_*` preferences (`src/lib/push/`, `NotificationSettings`).
9. `0010_slots.sql` — fixed break slots (`slot_key`, "vaste momenten").
10. `0011_game_scores.sql` + `0017_game_score_cheated.sql` +
    `0018_leaderboard_settings.sql` — Snake leaderboard (`game_scores`), a
    `cheated` flag, and a per-room show-cheated toggle.
11. `0014_message_reactions.sql` — emoji reactions on chat messages.
12. `0015_instant_break.sql` — "Pauze nu" instant breaks
    (`instant_break_pushes`/`instant_breaks`).
13. `0016_poker.sql` — multiplayer poker; the **model for shared-table games**
    (`poker_tables` public + `poker_private` deck + `poker_hole_cards`).
14. `0019_bibcoins.sql` — **bibcoins economy**: `wallets`, idempotent
    `bibcoin_transactions` ledger, `user_cosmetics`/`user_loadout`,
    `user_achievements`, and `SECURITY DEFINER` `award_/spend_/claim_hourly_`
    RPCs (revoked from `authenticated`, granted to `service_role`).
15. `0020_blackjack.sql` — single-player blackjack (**superseded by 0025**;
    `blackjack_games` left unused).
16. `0021_break_destinations.sql` + `0022_break_routes.sql` — destination /
    walk + map route points on proposals (free **and** fixed slots), reusable
    `room_places`. Inserts are resilient to these columns not existing yet.
17. `0023_chat_photos.sql` — `chat-photos` Storage bucket + 3-day `pg_cron`
    cleanup. Photos send as image URLs like GIFs.
18. `0024_step_sessions.sql` — steps: `step_sessions` (health=daily-total,
    browser=increments) + per-user `health_tokens` for the Apple Shortcut.
19. `0025_blackjack_multi.sql` + `0026_roulette.sql` — **shared-table
    multiplayer** blackjack & roulette (`blackjack_tables`+`blackjack_private`,
    `roulette_tables`), mirroring poker's design.

**RLS recursion is avoided with `SECURITY DEFINER` helpers**
(`is_room_member`, `is_room_owner`, `can_access_proposal`, `is_admin`): they
bypass RLS but still resolve `auth.uid()`. Never write a `room_members` policy
that selects from `room_members` directly — use `is_room_member()`.

Permissive policies combine with **OR**, so admin access is added as separate
`*_admin` policies alongside the member/owner ones.

Hand-written DB types in `src/types/database.ts` (shaped like the Supabase CLI
output so it can be the `createServerClient<Database>` generic). Update it when
the schema changes.

## Realtime pattern

Server fetches the initial snapshot; the client subscribes and patches on top.
Hooks in `src/hooks/use-*-realtime.ts`:

- Handlers are stored in a ref (updated in an effect, never during render —
  `react-hooks/refs`).
- **Each subscription uses a unique channel topic**
  (`room:${id}:proposals:${crypto.randomUUID()}`) so React Strict Mode's
  double-invoke can't re-add listeners to an already-subscribed channel.
- `break_proposals`/`presence`/`messages` filter by `room_id`; `votes` has no
  room column, so it's unfiltered and relies on RLS to scope events.
- Voting and chat send use optimistic updates with revert-on-error.
- **Shared-table games** (`poker_tables`/`blackjack_tables`/`roulette_tables`)
  broadcast a masked public state; clients are NOT optimistic — they wait for
  the server's next state. Realtime delivery needs the JWT on the socket
  (`client.ts` sets `realtime.setAuth`); without it RLS-scoped events never
  arrive. Use a singleton browser client.

## Routing

- `/` landing · `/login` `/register` (route group `(auth)`, redirect logged-in
  users to `/app`) · `/auth/confirm` email/magic-link callback.
- `/app` redirects to last-visited room (cookie) or `/app/rooms`.
- `/app/rooms`, `/app/rooms/new`, `/app/rooms/join`,
  `/app/rooms/[id]` (dashboard: proposals / presence / chat),
  `/app/rooms/[id]/chat`, `/app/rooms/[id]/eten` (food),
  `/app/rooms/[id]/games` (Snake, poker, blackjack, roulette, Pet Connect under
  `/games/*`), `/app/rooms/[id]/stappen` (steps),
  `/app/rooms/[id]/settings` (owner **or admin**), `/app/admin` (admin only),
  `/app/profile`. Room sub-tabs live in `RoomTabs`.
- `POST /api/steps` — token-authed endpoint for an Apple Shortcut to send a
  user's daily step total (`code` = `token~roomId`).

## Domain rules worth knowing

- Join codes: 6 chars from `A–Z2–9` excluding `0/O/1/I/L`.
- Proposals: date today…+7, start time on the quarter, duration ∈
  {15,30,45,60,90,120}. **One proposal per (room, date, start_time)** —
  duplicates are rejected in `createProposal`.
- Presence: daily lazy reset (anything before today 04:00 → "studying");
  >4h idle shows "last seen".
- **Inside joke:** users whose display name matches `/alan|chakalaka/i` have a
  half vote (weight 0.5) — see `src/lib/proposals/joke.ts`.
- **Admin:** owners *or* admins can manage a room (`canManageRoom`,
  `requireRoomAccess().canManage`). Promote a user with
  `update profiles set is_admin = true where id = …`; the seed creates an admin
  (`beheerder@bibsync.test`).
- **Bibcoins:** global per-user currency. **Balances are only writable
  server-side** via the `award_/spend_` RPCs (service role) — never from the
  client. Earn via voting, daily chat, games, +5/hour trickle, steps,
  achievements. Grant manually with
  `select public.award_bibcoins((select id from auth.users where email=…), N, 'manual', gen_random_uuid()::text);`.
- **Games are server-authoritative:** game logic runs with the service-role
  admin client (`src/lib/supabase/admin.ts`), persisted with an **optimistic
  version guard** (update `… where version = oldVersion`; a lost race returns a
  "busy" error and the client does not advance). Hidden state (decks, hole/
  dealer cards) lives in service-only `*_private` tables with RLS and no
  policies. Pure, unit-tested engines in `src/lib/<game>/`.
- **Steps:** daily total per user per room. `health` rows carry the running
  daily total (take the **max**), `browser` pedometer rows are increments
  (**sum**) — see `src/lib/steps/aggregate.ts`; never just sum all rows.
- **Inside joke (poker/games chips were bibcoins):** poker buy-in moves your
  whole balance to chips; blackjack/roulette bet per round straight from the
  wallet.

## Gotchas

- create-next-app installed Next **16**, not 15. Page `params`/`searchParams`
  are Promises — `await` them.
- A stray `~/package-lock.json` confused Next's workspace root → pinned via
  `turbopack.root` in `next.config.ts`.
- Email confirmation: Supabase's built-in mailer rate-limits hard; disable
  "Confirm email" for local testing, or expect "te veel pogingen".
- **Local `pnpm build` may fail on `next/font`** (Google Fonts fetch blocked in
  the sandbox). Verify with `pnpm exec tsc --noEmit` + `pnpm lint` + `pnpm test`;
  rely on Vercel for the real build (a failed Vercel build leaves prod on the
  old version = safe).
- **Reserved SQL words can't be column names** — e.g. `full` (from `FULL JOIN`)
  errors in `CREATE TABLE`; the Supabase SQL editor runs each migration in one
  transaction, so an error rolls back the whole script.

@AGENTS.md
