# CLAUDE.md — BibSync

Guidance for Claude Code (and humans) working in this repo.

## What this is

**BibSync** — a group-coordination web app for students studying together in
the library. Create a room, propose breaks and vote on them, see who's
studying/on a break in realtime, and chat per room. Dutch UI.

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

## Routing

- `/` landing · `/login` `/register` (route group `(auth)`, redirect logged-in
  users to `/app`) · `/auth/confirm` email/magic-link callback.
- `/app` redirects to last-visited room (cookie) or `/app/rooms`.
- `/app/rooms`, `/app/rooms/new`, `/app/rooms/join`,
  `/app/rooms/[id]` (dashboard: proposals / presence / chat),
  `/app/rooms/[id]/settings` (owner **or admin**), `/app/admin` (admin only),
  `/app/profile`.

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

## Gotchas

- create-next-app installed Next **16**, not 15. Page `params`/`searchParams`
  are Promises — `await` them.
- A stray `~/package-lock.json` confused Next's workspace root → pinned via
  `turbopack.root` in `next.config.ts`.
- Email confirmation: Supabase's built-in mailer rate-limits hard; disable
  "Confirm email" for local testing, or expect "te veel pogingen".

@AGENTS.md
