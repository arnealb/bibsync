# Skill games that pay bibcoins — design

**Date:** 2026-06-01
**Status:** Approved, ready for planning

## Goal

Expand the *skill* side of the Games library (today only Snake + Pet Connect,
versus a large pile of gambling games) with games that **earn** bibcoins through
play. Specifically:

1. **Fix Snake** so it pays **1 coin per apple eaten, every run** (not just the
   personal-best delta it pays today).
2. Add **Flappy Bird** — 1 coin per obstacle (pipe) passed.
3. Add two more skill games: **Tetris** (1 coin per line cleared) and **2048**
   (1 coin per new-highest-tile milestone).

Dutch UI, consistent with existing conventions (`src/lib/copy.ts`, server
actions returning `ActionResult`, pure unit-tested engines in `src/lib/games/`).

## Key decisions (from brainstorming)

- **No cap.** The owner explicitly chose **1 coin per event, every run, no daily
  cap.** This is farmable (eat one apple, die, repeat) but acceptable for a
  trusted friend group, and no weaker than Snake today (scores are already
  client-reported). The only retained safety bound is the existing schema max:
  a single run cannot submit a score above 100 000, so a broken/malicious client
  cannot mint millions in one call. A daily cap can be added later as a small,
  isolated change if abuse ever becomes a problem.
- **Snake payout is replaced, not stacked.** The old best-only `snake_best`
  payout is removed in favour of the new per-run model. The **Snake King** daily
  1000-coin leaderboard prize and the `snake_25`/`snake_100` achievements are
  untouched.
- **2048 coin trigger = new highest tile**, derived server-side as
  `log2(highestTile) − 1` (reaching 256 = 2^8 implies milestones 4..256 = 7
  coins). No separate client field, so the coin amount can't be lied about
  independently of the stored score.
- **New games:** Tetris + 2048 (chosen over Breakout / Stack Tower). 2048's
  swipe controls cover mobile; Flappy's tap controls cover mobile; Snake stays
  desktop-only as today.
- **Zero database migrations.** `game_scores.game_key` is plain `text` with no
  CHECK constraint, and the bibcoin ledger is generic, so new game keys and coin
  payouts work on the existing tables (same approach as Plinko/Dice).

## Earning model (shared by all four games)

On game-over the client submits `{ roomId, gameKey, score, runId }` where
`runId = crypto.randomUUID()` is generated once per run.

`submitGameScore` (server action) then:

1. Validates with the extended `submitScoreSchema` (`runId` added; `gameKey`
   enum extended).
2. Inserts `score` into `game_scores` (powers the GameCard "best" and Snake's
   existing leaderboard / King prize).
3. Awards coins via a new `earnFromArcade(userId, gameKey, score, runId, cheated)`
   in `src/lib/bibcoins/earn.ts`:
   - `cheated || score <= 0` → no coins.
   - `coins`:
     - Snake / Flappy / Tetris: `coins = score` (apples / pipes / lines).
     - 2048: `coins = Math.max(0, Math.floor(Math.log2(score)) - 1)`.
   - `awardBibcoins(userId, coins, \`${gameKey}_play\`, runId)` — idempotent on
     `(reason, ref)`, so a re-submitted run (network retry) pays once, but a new
     run (new UUID) pays again. **No cap.**

`REWARD.arcadePerEvent = 1` is added to `src/lib/bibcoins/config.ts` as the
single tuning knob (coins = events × `arcadePerEvent`).

The old `earnFromSnake` is replaced by routing `"snake"` through
`earnFromArcade` (preserving the cheated → 0 rule and the snake achievements).

## Per-game components

Each game follows the Snake template: a **pure, seeded, unit-tested engine** in
`src/lib/games/<game>/engine.ts` and a thin `"use client"` canvas/grid component
in `src/components/games/<game>/` that runs the loop, handles input, and submits
the score once on game-over (guarded by a `submittedRef`, like Snake).

### Snake (modify)

- No engine change. In `submitGameScore`, route `"snake"` to `earnFromArcade`
  (replacing `earnFromSnake`). Cheated (autopilot) runs still earn 0 and stay
  flagged on the leaderboard. `snake_25` / `snake_100` achievements preserved
  (move that logic into `earnFromArcade`'s snake branch or keep a small helper).

### Flappy Bird (new) — `flappy`

- Engine: bird `y` + velocity, gravity per tick, flap impulse, horizontally
  scrolling pipes with seeded gap positions, collision (pipes + floor/ceiling),
  `passed` counter incremented when a pipe's trailing edge crosses the bird.
- Client: canvas + `requestAnimationFrame`; tap / click / Space to flap. Mobile
  friendly. Submits `passed` as `score`. **1 coin per pipe.**

### Tetris (new) — `tetris`

- Engine: 10×20 board, 7-bag piece spawner (seeded), move/rotate/soft-drop/
  hard-drop, gravity tick, line detection + clear + collapse, `linesCleared`,
  game-over when a new piece can't spawn.
- Client: canvas + keyboard (arrows + Space hard-drop); a few on-screen buttons
  for touch. Submits `linesCleared`. **1 coin per line.**

### 2048 (new) — `2048`

- Engine: 4×4 grid, `move(dir)` (slide + merge, one merge per tile per move),
  spawn a 2 (90%) or 4 (10%) in a random free cell (seeded), `highestTile`,
  game-over when no moves remain.
- Client: tile grid, arrow keys **+ swipe**. Mobile friendly. Submits
  `highestTile` as `score`. **1 coin per new-highest-tile milestone.**
- Naming: internal `gameKey = "2048"`, route `src/app/app/rooms/[id]/games/2048/`,
  engine dir `src/lib/games/2048/`, component `twenty48-game.tsx`, copy block
  `copy.games.twenty48` (JS-identifier-safe).

## Shared plumbing

- `src/lib/validation/games.ts`: `GAME_KEYS` gains `"flappy"`, `"tetris"`,
  `"2048"`; `submitScoreSchema` gains `runId: z.string().uuid()`.
- `src/components/games/snake/snake-game.tsx`: generate a per-run `runId` and
  include it in the `submitGameScore` call (and the new games do the same).
- `src/app/app/rooms/[id]/games/page.tsx`: add three `GameCard`s (emoji 🐦 / 🧩 /
  🔢), each showing `getMyBestScore(id, userId, gameKey)`.
- New pages `games/{flappy,tetris,2048}/page.tsx` mirroring `snake/page.tsx`
  (header + game; **no** dedicated leaderboard/King panel for the new three).
- `src/lib/copy.ts`: Dutch strings for each new game (title, subtitle, controls,
  game-over, saved/score labels) plus any shared labels.

## Testing

- Unit tests per engine (`tests/unit/flappy-engine.test.ts`,
  `tetris-engine.test.ts`, `twenty48-engine.test.ts`) — deterministic via seed,
  mirroring `snake-engine.test.ts`: spawning, movement, scoring, collision /
  game-over, and (2048) merge correctness + highest-tile tracking.
- Unit test for the coin math, especially 2048's `log2(score) − 1`
  (e.g. 256 → 7, 4 → 1, 2 → 0).
- Gate: `pnpm exec tsc --noEmit` + `pnpm lint` + `pnpm test` all green.
  (Local `pnpm build` may fail on `next/font` per the repo notes — rely on
  Vercel for the real build.)

## Out of scope

- No daily cap (owner's explicit choice).
- No dedicated leaderboard panels or King-style daily prizes for Flappy / Tetris
  / 2048 — only the GameCard "best" stat.
- No new database tables, columns, RLS, or migrations.
- No mobile support for Snake (unchanged) or Tetris keyboard-only fallback
  beyond the on-screen buttons noted above.
