# STRUCTURE.md — repo map

A navigable map of the BibSync codebase so a new session can orient fast.
For *conventions* and *domain rules* read [`CLAUDE.md`](CLAUDE.md) first; this
file is the "where does X live" index. Paths are relative to the repo root.

> Keep this in sync when you add/move a feature: a stale map is worse than none.
> Last synced at migration `0035`.

## Top level

```
CLAUDE.md            Project guide — conventions, domain rules, gotchas (read first)
AGENTS.md            "This is Next 16, read node_modules/next/dist/docs before coding"
STRUCTURE.md         This file
README.md            Setup / run instructions
todo.md              Prioritised roadmap — work the "in progress" item, then next unchecked
bibsync-prompt-*.md  Original build-prompt history (foundation / core / chat-polish)
docs/superpowers/    Older plan + design specs (chat page & games)
next.config.ts       turbopack.root pin (stray ~/package-lock.json workaround)
vercel.json          Functions pinned to fra1 (match Supabase eu-central-1)
proxy.ts → src/      Next 16 renamed "middleware" to "proxy" (session refresh + /app guard)
scripts/             seed.ts (demo data, needs SUPABASE_SECRET_KEY) · gen-icons.mjs
playwright + vitest  Config at root; tests under tests/
```

## `src/app/` — routes (App Router)

```
layout.tsx · page.tsx (landing) · not-found.tsx · manifest.ts · globals.css
(auth)/                 login · register (route group; logged-in → /app)
auth/confirm/route.ts   email / magic-link callback
app/
  layout.tsx · page.tsx (→ last room or /app/rooms)
  admin/                admin-only dashboard
  profile/              own profile
  users/[id]/           public profile page
  shop/  ·  shop/earn/  bibcoins shop + earning overview
  rooms/                list · new · join
  rooms/[id]/           dashboard (page.tsx) + layout + loading
    chat/               chat tab
    stappen/            steps tab
    settings/           owner/admin settings
    games/              page (hub) + snake · poker · blackjack · roulette · mines · plinko · dice · crash · petconnect
api/
  steps/route.ts        token-authed Apple Shortcut endpoint (code = token~roomId)
  games/leave/route.ts  sendBeacon target for freeing a table seat
```

### `src/app/_actions/` — Server Actions

One file per domain. Each: Zod-parse → Supabase mutate → `revalidatePath` →
return `ActionResult`. `types.ts` / `auth-types.ts` hold shared types (a
`"use server"` file may only export async functions).

```
auth · profile · rooms · proposals · proposal-comments · presence · messages
reactions · instant-break · timeouts · steps · push
bibcoins · cosmetics · games · poker · blackjack · roulette
```

## `src/components/` — UI

Grouped by feature. `ui/` is shadcn/base-nova primitives (button, dialog,
select, …). Notable groups:

```
app/         app-header · room-switcher
auth/        login / register / magic-link forms + submit/message helpers
rooms/       room-dashboard · room-tabs (unread badge) · room-actions · headers
  settings/  rename · set-code · regenerate-code · member-list · delete · room-location
proposals/   proposals-panel · proposal-form · slot-card · proposal-card
             proposal-comments · proposal-calendar-bar
presence/    presence-sidebar · status-control · location-reporter
chat/        chat-panel · chat-input · message-list · message-reactions
             gif-picker · photo-upload · chat-image
routes/      route-field · route-map (leaflet; break route drawing)
bibcoins/    shop-panel · daily-claimer · hourly-claimer
cosmetics →  (via bibcoins/shop-panel + lib/cosmetics)
games/       game-card · leaderboard · session-leaderboard · snake/snake-game
poker/       poker-panel · playing-card
blackjack/   blackjack-panel · blackjack-strategy (cheat sheet)
roulette/    roulette-panel · roulette-wheel
petconnect/  petconnect-board
instant-break/ instant-break-panel ("Pauze nu")
steps/       step-counter · steps-leaderboard · health-sync-card
profile/     avatar-upload · display-name-edit · notification-settings · profile-link
misc/        user-avatar · theme-* · pwa-register · install-app-card · rainbow-init
```

## `src/lib/` — logic, queries, pure engines

```
supabase/    server · client · middleware · admin (service-role for games/seed)
validation/  Zod schemas, one per domain (never trust the client)
copy.ts      ALL Dutch user-facing strings
time.ts      Europe/Brussels, 24h, nl locale helpers
members.ts · initials.ts · auth.ts · env.ts · url.ts · utils.ts · geo.ts · slots.ts

proposals/   queries · group · calendar · winner · joke (½-vote) · present-tally
             visibility · presets (quick-pick destinations, incl. 🚬) · comments-queries
presence/    present (verdict) · location · display · view · queries
rooms/       queries · join-code · constants
messages/    queries · group
chat/        gif · reactions · reactions-queries · unread
profile/     queries
timeouts/    queries
steps/       aggregate (health=max, browser=sum) · pedometer · queries
push/        client · send
bibcoins/    config · award · earn · queries · achievements · unlock
cosmetics/   catalog · resolve · effects · queries

— pure, unit-tested game engines (logic only; persistence elsewhere) —
poker/       engine · evaluate · cards · config · queries
blackjack/   engine · table · queries
roulette/    engine · table · config · queries
mines/       engine (multiplier/payout/bomb-gen) · config · queries (single-player gok)
plinko/      engine (drop/multiplier/payout) · config (Stake-style tables) — stateless gok, no DB
dice/        engine (roll/win-chance/multiplier/payout) · config — stateless over/under gok, no DB
crash/       engine (crash-point/win/payout) · config — stateless auto-cashout rocket gok, no DB
games/       sessions · session-queries · queries · snake/{engine,bot,autopilot}
petconnect/  engine
instant-break/ status · config · queries
routes/      types
```

## `src/hooks/` — realtime subscriptions

`use-*-realtime.ts` — server fetches the snapshot, the hook subscribes and
patches. Unique channel topic per subscription (StrictMode-safe). Plus
`use-present-members`, `use-unread-chat`, `use-auto-leave-table`.

```
proposals · proposal-comments · presence · messages · reactions · timeouts
instant-break · steps · poker · blackjack · roulette · leaderboard-settings · bibcoins (live header balance)
```

## `src/types/database.ts`

Hand-written DB types shaped like Supabase CLI output; the
`createServerClient<Database>` generic. **Update when the schema changes.**

## `supabase/migrations/` — run manually in SQL editor, in order

Sequence jumps `0011 → 0014` (0012/0013 renumbered in a merge). Highlights:

```
0001 init · 0002 join_room · 0003 admin · 0004 proposal_comments
0006 avatars · 0008/0009 push · 0010 slots
0011/0017/0018 snake leaderboard (+cheated, +room toggle)
0014 reactions · 0015 instant_break · 0016 poker (model for shared-table games)
0019 bibcoins · 0020 blackjack (superseded) · 0025 blackjack_multi · 0026 roulette
0021/0022 break destinations + map routes (room_places)
0023 chat_photos · 0024 step_sessions
0027 timeouts · 0028 proposal_dedup · 0029 room_location · 0031 presence_checkin
0030 loadout title/effect cosmetics · 0032 coin_earning
0033 drop_food (the /eten food stack was removed) · 0034 public_profile
0035 display_name_change (paid once-per-day rename)
0036 mines (single-player gok: mines_games public + mines_private hidden bombs)
0037 bibcoin_transfer (transfer_bibcoins RPC — atomic p2p coin transfers)
0038 message_edit (edited_at + author update/delete RLS + replica identity full)
```

> Note: CLAUDE.md still references the food stack (migration 0005); it was
> dropped in `0033`. Trust the migrations for current schema.

## `tests/`

```
unit/   vitest — one file per engine/util (poker, blackjack, roulette, snake,
        steps, presence, slots, joke, winner, visibility, profile-validation, …)
e2e/    playwright — smoke.spec.ts · rooms-tabs.spec.ts
```

## Where to start for common tasks

- **New break-proposal behaviour** → `components/proposals/` + `_actions/proposals.ts` + `lib/proposals/`
- **New game** → mirror poker: pure engine in `lib/<game>/`, `_actions/<game>.ts` (service-role), `*_private` table, realtime hook, panel
- **Schema change** → add `supabase/migrations/00NN_*.sql` + update `src/types/database.ts`
- **New UI copy** → `src/lib/copy.ts` (Dutch), never hardcode in components
- **Bibcoins earning/spending** → `lib/bibcoins/` + the `award_/spend_` RPCs (server only)
```
