# Skill games that pay bibcoins — design

**Date:** 2026-06-01
**Status:** Approved, ready for planning

> This spec evolved through several rounds. The summary below is the **final
> agreed design**; earlier interim decisions (1 coin/event no-cap; Flappy
> dropped to 1/point) were superseded.

## Goal

Grow the *skill* side of the Games library and reward skilled play with bibcoins,
consistently across all skill games:

1. **Snake** — pays per apple, every run (replacing the old best-only payout).
2. **Flappy Bird** (already shipped by a teammate) — keep the **game** exactly as
   is; only move its **earning** onto the shared model below.
3. **Tetris** (new) — pays per line cleared.
4. **2048** (new) — pays per new-highest-tile milestone.
5. **A daily "King" for every skill game** (Snake, Flappy, Tetris, 2048 **and**
   Pet Connect), just like the existing Snake King: the top honest scorer in a
   room wins a bonus at end of day.

Dutch UI; existing conventions (`src/lib/copy.ts`, `ActionResult`, pure
unit-tested engines in `src/lib/games/`).

## Earning model (the per-event skill games: snake, flappy, tetris, 2048)

- **Per-game coins per event, tuned by difficulty** (faster/easier points pay
  less): **Snake 3/apple, Flappy 3/pipe, Tetris 8/line, 2048 12/new-tile**. 2048's
  event is a new highest tile, so it pays `(log2(highestTile) − 1) × 12`. Rates
  live in `ARCADE_COINS_PER_EVENT` (config).
- **Shared cap: 250 coins per hour** across all four games combined (rolling
  60-minute window). Once a user has earned 250 from these games in the last
  hour, further runs earn nothing until the window frees up. This is the
  anti-OP guardrail (replaces the earlier no-cap idea).
- Pays **every run** — the award uses a fresh server-side `crypto.randomUUID()`
  ref (no per-run client id needed), mirroring the pattern the merged
  `earnFromFlappy` already used. The hourly cap, not idempotency, governs total
  payout.
- **Cheated** (Snake autopilot) runs earn 0 and stay flagged on the leaderboard.
  Snake keeps its `snake_25` / `snake_100` achievements.
- **Pet Connect is NOT a per-event game** — its earning stays the existing
  once-a-day clear reward (`earnFromPetConnect`, 30 coins) and does **not** draw
  from the 250/hour pool. (It only gains a King; see below.)

### How `submitGameScore` routes

The action is unchanged in shape — the client still submits
`{ roomId, gameKey, score }` (Snake also `cheated`); **no new client field**.

- `petconnect` → `earnFromPetConnect` (unchanged).
- everything else (`snake`, `flappy`, `tetris`, `2048`) → a new
  `earnFromArcade(userId, gameKey, score, cheated)`:
  1. `desired = arcadeCoins(gameKey, score)` = `events × ARCADE_COINS_PER_EVENT[gameKey]`,
     where `events` = `score` for snake/flappy/tetris and
     `Math.max(0, Math.round(Math.log2(score)) − 1)` for `2048`.
  2. Read the user's last-hour sum of ledger rows whose `reason` is one of
     `snake`/`flappy`/`tetris`/`2048`; `remaining = max(0, 250 − earnedThisHour)`.
  3. `coins = min(desired, remaining)`; if `> 0`,
     `awardBibcoins(userId, coins, gameKey, crypto.randomUUID())`.
  4. Snake-only: unlock `snake_25` / `snake_100` from the raw score.

> Concurrency note: two simultaneous submits can both read the same
> `earnedThisHour` and slightly overshoot 250. Acceptable for a friends app (no
> real money); a fully atomic cap would need a DB function and isn't worth it.

`REWARD.snakeBestPerPoint` and `REWARD.flappyBestPerPoint` are deleted (their
functions `earnFromSnake` / `earnFromFlappy` are replaced by `earnFromArcade`).
The teammate's `FLAPPY_HOURLY_CAP = 250` is **renamed** to `ARCADE_HOURLY_CAP`
(now shared across the four games), and the `ARCADE_COINS_PER_EVENT` rate map is
added.

## Daily Kings (Snake + the four others)

The existing **Snake King** (`supabase/migrations/0047_snake_king.sql`):
`pg_cron` runs just after Brussels midnight and pays **1000** bibcoins to the
holder of each room's top honest `game_scores.score` for `snake`, idempotent per
`(room, Brussels date)` via the ledger. The crown badge is computed live from the
leaderboard (honest #1). **Snake King stays exactly as-is (1000).**

New work — **King for Flappy, Tetris, 2048 and Pet Connect at 500/day each**:

- **Migration `0050_game_kings.sql`** (run manually in Supabase, like the
  others): a `award_game_kings()` SECURITY DEFINER function that loops the four
  game keys, and for each room awards **500** to the top honest scorer, keyed
  `reason = '<game>_king'`, `ref = '<room>:<date>'` (idempotent per day). Revoked
  from `authenticated`, granted to `service_role`. Two `cron.schedule` entries
  (winter `1 23 * * *`, summer `1 22 * * *`) matching the Snake King job. Snake
  King's 0047 job is untouched.
- **Constant** `GAME_KING_REWARD = 500` in `src/lib/games/constants.ts`
  (`SNAKE_KING_REWARD = 1000` stays); kept in sync with the 500 in 0050.
- **UI:** generalise the crown badge so it isn't hardcoded to "Snake King":
  - `SnakeKingBadge` → `KingBadge({ reward, label })`; tooltip becomes a generic
    `copy.games.king.tooltip(label, n)`.
  - `Leaderboard` gains `kingLabel?: string` (defaults to "Snake King"), passed
    to the badge.
  - Each game's leaderboard passes `kingReward` + `kingLabel`:
    Snake `1000`/"Snake King" (default — page unchanged), Flappy / Tetris / 2048 /
    Pet Connect `500` + their label. Flappy and Pet Connect already render a
    `<Leaderboard>` (just add the two props); the new Tetris/2048 pages render one.

## New game engines & clients

Tetris and 2048 follow the Snake/Flappy template — a **pure, seeded, unit-tested
engine** in `src/lib/games/<game>/engine.ts` and a thin `"use client"`
canvas/grid component that submits the score once on game-over (`submittedRef`).

### Tetris (new) — `tetris`

- Engine: 10×20 board, 7-bag spawner (seeded), move/rotate/soft-drop/hard-drop,
  gravity tick, line detection + clear + collapse, `lines`, game-over when a new
  piece can't spawn.
- Client: canvas + keyboard (arrows + Space hard-drop) + a few on-screen buttons
  for touch. Submits `lines`. **10 coins per line** (shared cap).

### 2048 (new) — `2048`

- Engine: 4×4 grid, `move(dir)` (slide + merge once per tile), spawn 2 (90%) /
  4 (10%) seeded, `highestTile`, game-over when no moves remain.
- Client: tile grid, arrow keys **+ swipe**. Submits `highestTile`. **10 coins
  per new-highest-tile milestone** (shared cap).
- Naming: `gameKey = "2048"`, route `games/2048/`, engine/component dirs
  `twenty48`, copy block `copy.games.twenty48`.

## Shared plumbing

- `src/lib/validation/games.ts`: `GAME_KEYS` gains `"tetris"`, `"2048"`
  (`"flappy"` already present). No `runId`.
- `src/lib/bibcoins/config.ts`: add `ARCADE_COINS_PER_EVENT` (Snake 3, Flappy 3,
  Tetris 8, 2048 12); rename `FLAPPY_HOURLY_CAP` → `ARCADE_HOURLY_CAP` (shared);
  remove `snakeBestPerPoint`, `flappyBestPerPoint`.
- `src/lib/games/arcade-coins.ts` (new): pure `arcadeCoins(gameKey, score)` and a
  pure `cappedCoins(desired, earnedThisHour, cap)` clamp helper.
- `src/lib/bibcoins/earn.ts`: delete `earnFromSnake` + `earnFromFlappy`; add
  `earnFromArcade` (with the shared hourly cap).
- `src/app/_actions/games.ts`: route `petconnect` → `earnFromPetConnect`, all
  other keys → `earnFromArcade`.
- `src/app/app/rooms/[id]/games/page.tsx`: add Tetris (🧩) and 2048 (🧮; 🔢 is
  Keno's) cards.
- New pages `games/{tetris,2048}/page.tsx` (game + King leaderboard).
- `src/lib/copy.ts`: `copy.games.tetris`, `copy.games.twenty48`, and the generic
  `copy.games.king` block.
- King: `constants.ts` (`GAME_KING_REWARD`), `KingBadge`, `Leaderboard.kingLabel`,
  Flappy + Pet Connect page props, migration `0050_game_kings.sql`.
- **Untouched:** Flappy game/engine/page body, Keno, Snake & Pet Connect client
  components, Snake King migration 0047. (Flappy & Pet Connect pages only gain
  the two King props; that's the King feature, not the game.)

## Testing

- Unit tests for the new engines (`tetris-engine.test.ts`,
  `twenty48-engine.test.ts`) — deterministic via seed: spawn, movement, scoring,
  collision/game-over, and (2048) merge correctness + highest-tile.
- Unit tests for `arcadeCoins` (incl. 2048 `log2−1`) and `cappedCoins`
  (clamps to remaining headroom, never negative).
- `submitScoreSchema` test updated (new keys valid; `pacman` invalid).
- Gate: `pnpm exec tsc --noEmit` + `pnpm lint` + `pnpm test` green. (Local
  `pnpm build` may fail on `next/font`; rely on Vercel.)

## Out of scope

- No King for the gambling games (no score leaderboard; owner chose skill-games
  only).
- No per-game leaderboard panels on the games *overview* page beyond the existing
  Snake one — each game's King shows on that game's own page.
- No new DB tables/columns/RLS — only the `0050` cron migration (run manually).
- Snake stays desktop-only; Flappy/2048 cover mobile; Tetris adds touch buttons.
