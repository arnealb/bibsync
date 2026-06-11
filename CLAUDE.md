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
20. `0027_timeouts.sql` — **room timeouts** (`room_timeouts`, PK
    `(room_id,user_id)`): members SELECT; owner/admin INSERT+DELETE only (no
    UPDATE policy, so `setUserTimeout` upserts with `ignoreDuplicates` →
    `ON CONFLICT DO NOTHING`). Realtime. Drives the red `TimeoutBanner`; set via
    the `/timeout <naam>` / `/untimeout` chat commands (name completion).
21. `0028_proposal_dedup.sql` — **forbids duplicate proposals for all types**:
    de-dupes existing rows (keep most-voted, then earliest) then adds partial
    unique indexes — free proposals `(room_id, proposal_date, start_time,
    proposal_type) where slot_key is null`; slot prefs `(room_id,
    proposal_date, slot_key, created_by) where slot_key is not null`.
    `createProposal` pre-checks and maps `23505` → friendly "tijd al ingevuld".
22. `0029_room_location.sql` — **location-based presence**: rooms get an
    optional geofence (`lat`/`lng`/`radius_m`, default 150m); presence rows get
    `at_location` + `location_checked_at`. No new RLS (members already update
    their own presence row; owners/admins their room).
23. `0030_loadout_title_effect.sql` — two premium cosmetic slots on
    `user_loadout`: `title` (flair text next to your name) and `effect`
    (animated name styling). Catalogue/prices in `src/lib/cosmetics/catalog.ts`.
24. `0031_presence_checkin.sql` — `presence.checked_in_on` (date): manual daily
    "I'm here today" check-in, an alternative to location presence.
25. `0036_mines.sql` — **single-player Mines (gok)**: `mines_games` (public,
    owner-readable state, PK `(room_id,user_id)`) + `mines_private` (service-only
    hidden bomb positions, RLS on / no policies). Wallet bet via `spend_/award_`,
    version-guarded persistence; pure engine in `src/lib/mines/`. (Migrations
    `0032`–`0035` exist but predate this list — trust the migration files.)
26. `0061_theft_debt.sql` — **theft debt**: `wallets.debt` + the
    `wallets_garnish_credit` BEFORE-UPDATE trigger (burns half of every wallet
    credit while `debt > 0`; refund-style awards exempt — mirror
    `isGarnishExempt` in `src/lib/theft/debt.ts`) + `add_wallet_debt` RPC.
27. `0062_stock_volatility.sql` — **BIB-aandeel volatility**: the hourly
    `snapshot_casino_stock()` fold now applies a 75% profit skim (only 25% of
    casino P&L reaches holders), a 2%/day fee, EV-neutral lognormal noise
    (±1.6%/h, clamped ±7%) and EV-0 crash/rally events (1%/h ×0.55–0.80,
    2%/h ×1.10–1.225) logged in `casino_stock_history.event` and marked on
    the chart. The fold is version-guarded like the trade actions (a lost
    race skips the tick). The skim also lives in the engine's `liveTreasury`,
    so trade-time folds can't bypass it. Pure mirror + Monte-Carlo EV guards in
    `src/lib/stock/tick.ts`; constants in `src/lib/stock/config.ts` (SQL
    authoritative).
28. `0064_minesweeper_time.sql` — **Minesweeper ranks on time per
    difficulty**: replaces `award_game_kings()` so the old single
    `minesweeper` key drops out and `minesweeper_easy/medium/hard` each crown
    a daily King (fastest honest win). No schema change — the app records
    wins only, with `duration_seconds` set. See the skill-games bullet below.
29. `0065_dino_king.sql` — **Dino Runner King**: the Chrome offline T-Rex
    game joins the arcade (`dino` key, score = obstacles dodged, 3 coins
    each); replaces `award_game_kings()` with `dino` added. No schema change.
30. `0066_horse_races.sql` — **Paardenraces**: one GLOBAL race per clock
    hour (`horse_races` + `horse_race_bets`, both authenticated-readable +
    realtime). Six horses with random stats; win chance ∝ strength⁴ (floored
    at 2% from the favourite), fixed odds, payouts floored.
    `place_horse_bet()` locks the race row (serialises with the resolver);
    `run_horse_races()` (pg_cron `0 * * * *`) resolves due races, pays
    idempotently per bet id, and opens the next race. Also redefines
    `casino_stats()` (supersedes 0052) with `horses_bet`/`horses_payout`,
    so the racebook moves the BIB-aandeel. Odds + replay MIRRORED in
    `src/lib/horses/` (EV-guard tests) — SQL authoritative.
31. `0067_horse_podium.sql` — **Paardenraces v2 (podium)**: adds
    `horse_races.finish_order`; the resolver now draws the FULL finishing
    order (Plackett–Luce: sequential weighted draws on `winBp`) and 1st/2nd/
    3rd pay out. Odds per spot fixed at creation: `mult_k = α_k / P(k-th)`
    with α = 70/15/10% (Σ = 95%), P(2nd)/P(3rd) the exact Plackett–Luce
    place probabilities → EV is exactly 95% of the stake per horse. Legacy
    (pre-0067) races resolve with their stored win-only `multBp` (places 0).

**Plinko** (`/games/plinko`) is a **stateless** gok: one `dropPlinko` action
stakes the bet, rolls the ball server-side and pays out instantly — no table,
no migration. Pure engine + Stake-style multiplier tables in `src/lib/plinko/`;
the client only animates the returned path.

**Dice** (`/games/dice`) is likewise **stateless**: `placeDiceBet` stakes,
rolls 0.00–99.99 and pays out. Pick a target (2.00–98.00) and over/under;
multiplier = `(1 − houseEdge) / winChance` from the *actual* discrete chance.
Pure engine in `src/lib/dice/`.

**Paardenraces** (`/games/horses`, migrations `0066`+`0067`) is the **hourly
global race**: betting all hour (multiple bets/horses per user allowed), the
pg_cron resolver draws the full finishing order at :00 and a fresh field (new
stats/odds/names) opens; **1st/2nd/3rd pay out** at per-spot odds. The race
then plays **LIVE for one minute**, anchored to `runs_at` wall clock — every
client renders the same deterministic animation from `run_seed` (`raceScript`
in `src/lib/horses/engine.ts`; the stored order always plays out, pure
cosmetics since betting closed at the draw). The panel hides the results
(payout chips, winner strip) until the live minute has passed. Horse names
derive from `name_seed` (`src/lib/horses/names.ts`), so all clients see the
same line-up. The panel refetches the whole snapshot (`getHorsesView`) on any
realtime event instead of patching rows, with a 5s poll fallback while a due
race waits for the cron.

All gok payouts use **`Math.floor`** (never `round`) so they can't exceed
bet × multiplier — `round` is exploitable (pick a bet where it rounds up on a
near-certain bet → +EV). Guard tests assert EV ≤ stake / RTP ≤ 1 for every
parameter combo.

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
- **Unread chat badge** (iPhone-homescreen style): `useUnreadChat` lives in the
  always-mounted `RoomTabs`, so it keeps counting on every tab. Read-state is a
  per-room localStorage ISO marker (`bibsync:chat-read:<roomId>`); on mount it
  counts messages since the marker (minus your own), realtime inserts bump it
  live. The chat page calls `markChatRead` (enter/leave/new message) which
  resets the badge via the in-tab `onChatRead` pub/sub — no DB table needed.
  Reset happens in the event callback, never as sync setState in an effect body.

## Routing

- `/` landing · `/login` `/register` (route group `(auth)`, redirect logged-in
  users to `/app`) · `/auth/confirm` email/magic-link callback.
- `/app` redirects to last-visited room (cookie) or `/app/rooms`.
- `/app/rooms`, `/app/rooms/new`, `/app/rooms/join`,
  `/app/rooms/[id]` (dashboard: proposals / presence / chat),
  `/app/rooms/[id]/chat`, `/app/rooms/[id]/eten` (food),
  `/app/rooms/[id]/games` (Snake, poker, blackjack, roulette, mines, plinko,
  dice, Pet Connect under `/games/*`), `/app/rooms/[id]/stappen` (steps),
  `/app/rooms/[id]/schermtijd` (screen-time overview),
  `/app/rooms/[id]/voetbal` (footballer naming game),
  `/app/rooms/[id]/settings` (owner **or admin**), `/app/admin` (admin only),
  `/app/profile`. Room sub-tabs live in `RoomTabs`, which also renders the
  unread-chat badge on the Chat tab.
- `POST /api/steps` — token-authed endpoint for an Apple Shortcut to send a
  user's daily step total (`code` = `token~roomId`).

## Domain rules worth knowing

- Join codes: auto-generated = 6 chars from `A–Z2–9` excluding `0/O/1/I/L`.
  **Custom codes** (set at room creation or in settings via `setJoinCode`) are
  4–12 chars, stored upper-cased; `checkJoinCode` (admin client) tests
  availability and `23505` maps to "code al in gebruik". See
  `src/lib/rooms/join-code.ts`.
- Proposals: date today…+7, start time on the quarter, duration ∈
  {15,30,45,60,90,120}. **No duplicate proposals** (enforced by 0028 partial
  unique indexes, all types): one free proposal per (room, date, time, type);
  one slot preference per (room, date, slot, user) — multiple users may still
  prefer the same slot time, that's how consensus forms.
- **Fixed slots ("vaste momenten"):** the break time is simply the most-backed
  time (`decideSlotTime` — preferences + yes-votes, weighted, earliest wins
  ties), shown big in `SlotCard`; **no averaging**. Free proposals are
  **interleaved** into the day timeline at their time (amber accent, "💡 Vrij
  voorstel") instead of a separate section. The calendar defaults to **day** view.
- Presence: daily lazy reset (anything before today 04:00 → "studying");
  >4h idle shows "last seen".
- **Location presence:** owners/admins set a room geofence (centre + radius)
  in settings (`RoomLocationSettings`, reuses the leaflet map). The browser
  `LocationReporter` periodically (3 min) sends its position to `reportLocation`,
  which compares it to the geofence **server-side** and stores only the verdict
  (`at_location` + `location_checked_at`) — never raw coordinates. The sidebar
  shows "📍 ter plaatse / niet ter plaatse" via `locationStatus` (fresh ≤10 min,
  else unknown) and ranks confirmed-present members first. Manual status is
  untouched; location reports never bump `updated_at`. **Alternative for people
  who won't share location:** a manual daily **check-in** (`setCheckIn` →
  `presence.checked_in_on` = today's Brussels date) also counts as present.
  `presenceVerdict` (in `lib/presence/present.ts`) combines both: `here`
  (location) / `checked-in` (manual today) → present; `away` / `unknown`
  otherwise. **Only present members may propose/vote/comment** —
  `isUserPresent` (server) gates `createProposal`/`castVote`/
  `setSlotPreference`/`addProposalComment`; the panel disables the controls +
  shows a hint otherwise. (Food voting on `/eten` is a separate stack, not
  gated.) **Vote tallies are present-scoped:** cards show
  `<present yes>/<present total>` etc. (`presentTally` + `usePresentMembers`) —
  only people actually at the room count; with no present data they fall back
  to the weighted all-votes tally.
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
- **Skill games earn coins per event:** Snake/Flappy/Dino/Tetris/2048/
  Minesweeper pay a per-game rate (`ARCADE_COINS_PER_EVENT` = 3/3/3/8/12/1)
  per apple/pipe/obstacle/line/new-tile/safe-cell via
  `earnFromArcade` (fresh server-side ref, so every run pays), clamped to a
  shared **250 bibcoins/clock-hour** cap (`ARCADE_HOURLY_CAP`); the
  `ArcadeCapBar` on each game page shows usage + a countdown to the next `:00`.
  Pure coin/window helpers in `src/lib/games/arcade-coins.ts` /
  `arcade-window.ts`. Every skill game has a daily **King** (top honest
  `game_scores` score per room): Snake 1000 (cron `0047`), the others 500
  (cron `0051_game_kings.sql`; `0060` adds USA Staten, `0063`/`0064`
  Minesweeper, `0065` Dino to the same function); the crown is the generic
  `KingBadge`.
  Score ties rank the **fastest run** first (`game_scores.duration_seconds` =
  seconds to the run's last point; USA Staten and Minesweeper fill it; pure
  helpers in `src/lib/games/rank.ts`), then the earliest record holder.
  **Minesweeper ranks on time per difficulty** (migration `0064`): keys
  `minesweeper_easy/medium/hard` (`src/lib/games/minesweeper/keys.ts`); only
  WON games insert a row (score = the constant safe-cell count +
  `duration_seconds`, so score-desc/time-asc ranking ⇒ fastest win first;
  each difficulty crowns its own daily King); lost games submit with
  `coinsOnly: true` — coins per revealed cell, no leaderboard row. The three
  boards render with `Leaderboard timeOnly`. Classic dark look, original
  number colours; pure engine in `src/lib/games/minesweeper/`.
- **Leaving a table frees the seat:** blackjack/poker panels use
  `useAutoLeaveTable` — SPA navigation away unmounts the panel and calls the
  (idempotent) leave action after a debounced tick (StrictMode-remount-safe);
  tab close/refresh fires a `sendBeacon` to `POST /api/games/leave`; and while
  seated (`armed`), **3 min without any interaction** auto-leaves so an AFK
  player can't block the table. No more ghosts "still sitting" after they've
  gone. Roulette has no seats (bets are per-round), so nothing to leave there.
- **Voetbal (game hub):** the `/app/rooms/[id]/voetbal` tab is a hub
  (`VoetbalHub`) with four modes (`src/lib/voetbal/modes.ts`): **Namen raden**
  (type players in 120s), **Hoger/Lager** (compare market values),
  **Voetbalquiz** (multiplechoice trivia) and **Raad de speler** (progressive
  clues). All modes are **server-authoritative & stateless** — the action hands
  the client only masked data (never the answer), validates server-side, and
  pays via `awardVoetbalCapped` (`src/lib/voetbal/earn.ts`): idempotent per a
  per-event ref, all sharing **one 750/hour ledger pool** (`VOETBAL_HOURLY_CAP`,
  reason `voetbal`) so no mode can be farmed past the cap. Rewards:
  name 25 / hoger-lager 20 / quiz 30 / mystery 60. Answer data is **server-only**
  (`data.ts` / `players.ts` / `quiz.ts` — never import into a client component);
  client-safe metadata is in `categories.ts` / `modes.ts`. Actions:
  `_actions/voetbal.ts` (naming) + `_actions/voetbal-modes.ts` (the other three);
  cap bar shared at hub level via `getVoetbalHourEarned`.
- **Steps:** daily total per user per room. `health` rows carry the running
  daily total (take the **max**), `browser` pedometer rows are increments
  (**sum**) — see `src/lib/steps/aggregate.ts`; never just sum all rows.
- **Schermtijd (screen time, migration 0057):** the always-mounted
  `ScreenTimeTracker` (app layout) sends a heartbeat every 60s while the tab is
  **visible**; `record_screen_time` (SECURITY DEFINER) credits only the real
  wall-clock gap since the previous beat, capped at 90s/beat — so spamming can't
  inflate it and a closed tab accrues nothing. A `_resume` beat (sent on
  becoming visible) just resets the baseline, so hidden-tab time is never
  counted. Reward: **10 bibcoins per full minute/day**, capped at 720 min/day,
  idempotent via the per-day `awarded_coins` guard. Shown on `/app/profile`
  (`getScreenTime`, with a per-day stats table) and per-room on the
  **Schermtijd** tab (`/app/rooms/[id]/schermtijd`): a ranked leaderboard +
  coins-earned + a 14-day bar chart (`getRoomScreenTime` → pure
  `aggregateRoomScreenTime`). Cross-user reads use migration **0058**'s
  `shares_room()` SECURITY DEFINER helper + the `screen_time_roommates` RLS
  policy (members may read fellow members' rows). Pure helpers in
  `src/lib/screen-time/`.
- **Inside joke (poker/games chips were bibcoins):** poker buy-in moves your
  whole balance to chips; blackjack/roulette bet per round straight from the
  wallet.
- **Timeouts:** owners/admins (`canManage`) can put a member in timeout via the
  `/timeout <naam>` chat command (name completion) or `/untimeout`; the target
  sees a red `TimeoutBanner`. Backed by `room_timeouts` (see migration 0027).
- **Schandpaal (pillory):** a member on the room's schandpaal (`room_pillory`,
  migration 0049) is **frozen out of every room action** — games, chat,
  reactions, voting, proposing, commenting, marketplace, food bets, instant
  break. Enforcement: `requireRoomAccess` now resolves `isPilloried`
  (`isOnPillory`), and each mutation bails with `copy.pillory.frozen` (helper
  `pilloryGuard`, or an inline `access.isPilloried` / `isOnPillory(...)` check in
  the auth-context actions). The **only** escape is buying yourself off
  (`buyOffPillory`); **stealing stays allowed** because it's a global profile
  action that never routes through a room's `requireRoomAccess`.
- **Stelen-schuld:** a caught thief owes 2×. Collection order: wallet drain →
  forced sale of their BIB-aandelen (`seizeStockValue` in `_actions/theft.ts`,
  version-guarded like `sellStock`; a lost race skips seizure) → the rest
  becomes `wallets.debt`. While `debt > 0` the garnish trigger burns **half of
  every wallet credit** (ledger reason `theft_debt_repayment` — the `theft_`
  prefix keeps it out of the claim-window spend check), stealing is blocked
  (`copy.theft.debtBlocked`), and the header balance shows a red `−debt` chip.
  The victim is still paid the full 2× instantly; garnished coins are burned
  to offset that mint.

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
- **`vercel.json` pins functions to `fra1`** (Frankfurt) to match Supabase in
  `eu-central-1` — the default `iad1` (US) added cross-Atlantic latency to every
  query. This was the main "app feels slow" fix; per-tab `loading.tsx` skeletons
  (`games`/`chat`/`eten`/`stappen`) smooth perceived load.

@AGENTS.md
