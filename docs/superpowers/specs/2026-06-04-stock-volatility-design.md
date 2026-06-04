# BIB-aandeel volatility — design

**Date:** 2026-06-04
**Status:** approved (brainstorm with owner)

## Problem

The BIB-aandeel (casino NAV fund, migrations `0050`/`0055`) only ever rises.
Every house-banked bet has a house edge, so casino net profit grows
structurally and the hourly fold pushes the price up. The 1%/day management
fee (`0055`) is far smaller than the profit inflow whenever anyone gambles.
Result: the chart is a monotone staircase and parking coins in the stock is a
guaranteed win.

Owner wants: realistic price action — hourly ups and downs, real declines when
the casino is quiet, and occasional hard crashes — with a **long-run neutral**
expected value for holders (noise and events are EV-0; the structural house
edge is skimmed away).

## Goals

- Price moves visibly every hour, both up and down.
- Occasional crashes (and smaller, more frequent rallies), marked on the chart.
- Long-run EV of holding ≈ neutral, independent of how busy the casino is.
- All movement stays inside the NAV model: price = treasury / shares, payouts
  bounded by treasury, declines are burned coins (sink), no separate price
  bookkeeping.

## Non-goals

- No chat messages or news banners for events (chart-only).
- No change to the buy/sell actions or holding cap. Noise/events/fee stay
  fold-only (between folds the price stays deterministic) — the one engine
  change is the skim inside `liveTreasury`, see Design §1.
- No mean reversion or predictable patterns (those would create timing
  exploits).

## Design

### 1. Migration `supabase/migrations/0062_stock_volatility.sql`

`alter table public.casino_stock_history add column if not exists event text
check (event in ('crash','rally'));`

Replace `snapshot_casino_stock()` (same cron, `7 * * * *`). Per hourly tick,
when `shares > 0`, in this order:

1. **Fold + profit skim.** `delta := net - baseline_net;`
   `tre := treasury + delta * (1 - 0.75)` — only 25% of casino P&L (both
   signs, symmetric) reaches holders; the skimmed 75% is burned. This is what
   makes the long run neutral regardless of activity. The same skim lives in
   the engine's `liveTreasury` (the fold point used by buy/sell/seizure
   pricing), so a trade folding the accrued delta skims it identically — you
   cannot trade just before the tick to capture un-skimmed P&L, and a trade
   resetting `baseline_net` no longer disables the skim for other holders.
2. **Management fee.** `tre := tre * power(1 - 0.02, 1.0/24)` — raised from
   1%/day to **2%/day**, same hourly-root compounding as `0055`.
3. **Noise.** Lognormal hourly factor with arithmetic mean exactly 1:
   `z := sqrt(-2 * ln(1 - random())) * cos(2 * pi() * random())` (Box–Muller;
   `1 - random()` avoids `ln(0)`), `factor := exp(0.016 * z - 0.016^2 / 2)`,
   clamped to `[0.93, 1.07]`. `tre := tre * factor`. σ = 1.6%/hour ≈ 8%/day.
4. **Event roll.** One `roll := random()`:
   - `roll < 0.01` → **crash**: `tre := tre * (0.55 + random() * 0.25)`
     (×0.55–0.80, i.e. −20…−45%), `event := 'crash'`.
   - `roll < 0.03` (else-if) → **rally**: `tre := tre * (1.10 + random() * 0.125)`
     (×1.10–1.225, i.e. +10…+22.5%), `event := 'rally'`.
   - EV check: `0.01 × (0.675 − 1) = −0.00325`;
     `0.02 × (1.1625 − 1) = +0.00325` → events are EV-0.
5. `tre := greatest(0, tre)`; update `casino_stock` (treasury, baseline_net,
   updated_at); `price := greatest(1, tre / shares)`.

History insert gains the event: `insert into casino_stock_history
(price, shares, net, event) values (…, _event)` (`_event` is null on normal
ticks and when `shares = 0`; the `shares = 0` branch stays as-is, price 100).

No ledger rows for skim/fee/noise burns — same convention as the existing fee.

### 2. Config (`src/lib/stock/config.ts`)

Update `MANAGEMENT_FEE_DAILY` to `0.02` and add (all with a
"MIRROR of 0062_stock_volatility.sql" note, SQL authoritative):

```ts
export const PROFIT_SKIM = 0.75;        // share of casino P&L burned at fold
export const NOISE_SD_HOURLY = 0.016;   // lognormal sigma per hourly tick
export const NOISE_CLAMP = 0.07;        // per-tick noise bounded to ±7%
export const CRASH_CHANCE_HOURLY = 0.01;
export const CRASH_FACTOR_MIN = 0.55;   // worst crash: −45%
export const CRASH_FACTOR_MAX = 0.8;    // mildest crash: −20%
export const RALLY_CHANCE_HOURLY = 0.02;
export const RALLY_FACTOR_MIN = 1.1;    // mildest rally: +10%
export const RALLY_FACTOR_MAX = 1.225;  // best rally: +22.5%
```

### 3. Pure TS mirror (`src/lib/stock/tick.ts`)

Mirrors the SQL tick math for tests; takes its randomness as inputs so it is
deterministic:

```ts
export interface TickRand {
  gauss: number; // standard normal draw (z)
  roll: number;  // event roll, uniform [0,1)
  size: number;  // event size draw, uniform [0,1)
}
export interface TickResult {
  treasury: number;
  event: "crash" | "rally" | null;
}
/** One hourly fold: skim → fee → noise → event. Mirror of 0062 (SQL wins). */
export function applyVolatilityTick(
  treasury: number,
  deltaNet: number,
  rand: TickRand,
): TickResult;
```

### 4. Chart + types

- `StockTick` gains `event: "crash" | "rally" | null`;
  `getStockHistory` selects the new column; `database.ts` history Row/Insert
  gain `event`.
- `PriceChart` draws a dot on event ticks (red `crash` / green `rally`,
  radius ~3, `vectorEffect="non-scaling-stroke"`-style sizing not needed —
  fixed `r` is fine in the 300×96 viewBox) with a native `<title>` tooltip:
  Dutch copy from `copy.stock.crashMark` / `copy.stock.rallyMark`
  (e.g. "📉 Crash" / "📈 Rally").
- `StockQuote.feeDaily` already flows from config, so the fee shown in the UI
  updates automatically.

### 5. Tests (`tests/unit/stock-tick.test.ts`)

Vitest, seeded PRNG (mulberry32-style local helper):

- **EV guard (Monte Carlo, ~200k ticks, deltaNet = 0):** mean treasury factor
  within tolerance of the fee-only keep `(1 - 0.02)^(1/24)` (noise + events
  net out to 1).
- Crash frequency ≈ 1%, rally ≈ 2% (tolerances).
- Noise factor never outside `[1 − NOISE_CLAMP, 1 + NOISE_CLAMP]` before the
  event multiplier; treasury never negative.
- Skim: `deltaNet` contributes exactly `(1 − PROFIT_SKIM) × deltaNet`, both
  signs.
- Event sizes stay inside their configured factor ranges.

## Edge cases

- `shares = 0`: no skim/fee/noise/event; price pinned at `INITIAL_PRICE` (100),
  history row has `event = null`. Unchanged from today.
- Crash bottom: treasury can approach 0; `sellPrice` already floors at 0 and
  the buy price floors at `MIN_PRICE` — no new guards needed.
- Trades between ticks: unaffected; noise/events exist only at fold time, so
  nothing double-applies.
- Trades concurrent with the tick: the fold update is version-guarded like the
  trade actions (bumps `casino_stock.version`); on a lost race the tick skips
  entirely (no fold, no history row) — a trade is never clobbered. The losing
  side of the opposite race is the trade, which already returns its "busy"
  error and the client retries.
- Owner's manual price pinning (direct treasury/baseline_net/version update)
  keeps working; the next tick simply continues from the pinned value.
- Old history rows: `event` is null — chart handles missing field.
- Fee-dodging by selling at :06 and rebuying at :08 dodges only the fee
  (~0.084%/hour) — the skim applies at trade time too, and noise/events are
  EV-0 so sitting them out changes nothing in expectation. Accepted
  (pre-existing since 0055; needs hourly babysitting for a tiny edge).
- Crash/rally dots render from fetched history (page load); the live
  realtime/poll path appends plain ticks (`event: null`), so a dot for an
  event that happens while watching appears on the next page visit. Accepted
  (the price move itself is visible live).

## Rollout

Run the migration BEFORE deploying the app: `getStockHistory` selects the
`event` column, so the new app against an un-migrated DB logs an error and
renders an empty chart (graceful, but ugly) until 0062 is applied. The
migrated DB under the old app is fully compatible (old code never references
`event`). Verify with
`pnpm exec tsc --noEmit` + `pnpm lint` + `pnpm test` (local `pnpm build` may
fail on `next/font`; Vercel does the real build).
