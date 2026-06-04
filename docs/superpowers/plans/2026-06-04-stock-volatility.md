# BIB-aandeel Volatility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the BIB-aandeel price fall as well as rise — hourly noise, occasional crashes/rallies (marked on the chart), a profit skim and a heavier fee so long-run holding EV is ~neutral.

**Architecture:** All movement happens inside the existing NAV model at fold time: the hourly `snapshot_casino_stock()` (pg_cron) gains four steps — 75% profit skim → 2%/day fee → EV-1 lognormal noise → EV-0 crash/rally roll — all multiplying the treasury (price stays `treasury / shares`, payouts stay covered). A pure TS mirror (`src/lib/stock/tick.ts`) exists only for Monte-Carlo EV guard tests; SQL is authoritative. The chart marks event ticks via a new `casino_stock_history.event` column.

**Tech Stack:** Next.js 16 / TypeScript strict, Supabase (plpgsql migration, run manually), vitest, existing dependency-free SVG chart.

**Spec:** `docs/superpowers/specs/2026-06-04-stock-volatility-design.md`

**Branch:** `feat/stock-volatility` (already created; spec committed).

**Verification baseline:** `pnpm exec tsc --noEmit` has 4 known pre-existing errors on main (two `.next/*/types/validator.ts` "Cannot find module … eten/page.js", two in `src/components/routes/route-map.tsx`). The gate everywhere below is: **no NEW errors beyond those 4**. `pnpm lint` and `pnpm test` must be fully clean. Local `pnpm build` may fail on `next/font` (sandboxed Google Fonts) — do not use it as a gate.

---

### Task 1: Config constants + pure tick mirror (TDD)

**Files:**
- Modify: `src/lib/stock/config.ts` (fee 0.01 → 0.02 + new volatility constants)
- Create: `src/lib/stock/tick.ts`
- Test: `tests/unit/stock-tick.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/stock-tick.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  CRASH_CHANCE_HOURLY,
  CRASH_FACTOR_MAX,
  CRASH_FACTOR_MIN,
  MANAGEMENT_FEE_DAILY,
  NOISE_CLAMP,
  NOISE_SD_HOURLY,
  PROFIT_SKIM,
  RALLY_CHANCE_HOURLY,
  RALLY_FACTOR_MAX,
  RALLY_FACTOR_MIN,
} from "@/lib/stock/config";
import { applyVolatilityTick, type TickRand } from "@/lib/stock/tick";

/** Deterministic PRNG so the Monte-Carlo guards are reproducible. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal via Box–Muller (mirrors the SQL draw). */
function gauss(rng: () => number): number {
  return Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());
}

function draw(rng: () => number): TickRand {
  return { gauss: gauss(rng), roll: rng(), size: rng() };
}

const KEEP_HOURLY = Math.pow(1 - MANAGEMENT_FEE_DAILY, 1 / 24);
/** gauss 0, roll misses both events, size irrelevant. */
const NEUTRAL: TickRand = { gauss: 0, roll: 0.99, size: 0.5 };
/** The deterministic noise factor at gauss = 0 (mean-1 correction). */
const NOISE_AT_ZERO = Math.exp((-NOISE_SD_HOURLY * NOISE_SD_HOURLY) / 2);

describe("applyVolatilityTick — deterministic pieces", () => {
  it("burns the management fee at the hourly root", () => {
    const r = applyVolatilityTick(100_000, 0, NEUTRAL);
    expect(r.treasury).toBeCloseTo(100_000 * KEEP_HOURLY * NOISE_AT_ZERO, 6);
    expect(r.event).toBeNull();
  });

  it("passes exactly (1 − PROFIT_SKIM) of casino P&L through, both signs", () => {
    const T = 100_000;
    const base = applyVolatilityTick(T, 0, NEUTRAL).treasury;
    const up = applyVolatilityTick(T, 1000, NEUTRAL).treasury;
    const down = applyVolatilityTick(T, -1000, NEUTRAL).treasury;
    const mult = base / T; // fee × noise at this rand
    expect(up - base).toBeCloseTo(1000 * (1 - PROFIT_SKIM) * mult, 6);
    expect(base - down).toBeCloseTo(1000 * (1 - PROFIT_SKIM) * mult, 6);
  });

  it("clamps a single noise tick to ±NOISE_CLAMP", () => {
    const hi = applyVolatilityTick(100_000, 0, { gauss: 50, roll: 0.99, size: 0 });
    const lo = applyVolatilityTick(100_000, 0, { gauss: -50, roll: 0.99, size: 0 });
    expect(hi.treasury).toBeCloseTo(100_000 * KEEP_HOURLY * (1 + NOISE_CLAMP), 6);
    expect(lo.treasury).toBeCloseTo(100_000 * KEEP_HOURLY * (1 - NOISE_CLAMP), 6);
  });

  it("applies a crash inside the configured factor range", () => {
    const noEvent = applyVolatilityTick(100_000, 0, NEUTRAL).treasury;
    const worst = applyVolatilityTick(100_000, 0, { gauss: 0, roll: 0, size: 0 });
    expect(worst.event).toBe("crash");
    expect(worst.treasury).toBeCloseTo(noEvent * CRASH_FACTOR_MIN, 6);
    const mildest = applyVolatilityTick(100_000, 0, { gauss: 0, roll: 0, size: 1 });
    expect(mildest.event).toBe("crash");
    expect(mildest.treasury).toBeCloseTo(noEvent * CRASH_FACTOR_MAX, 6);
  });

  it("applies a rally inside the configured factor range", () => {
    const noEvent = applyVolatilityTick(100_000, 0, NEUTRAL).treasury;
    // roll exactly at the crash bound falls through to the rally branch
    const small = applyVolatilityTick(100_000, 0, {
      gauss: 0,
      roll: CRASH_CHANCE_HOURLY,
      size: 0,
    });
    expect(small.event).toBe("rally");
    expect(small.treasury).toBeCloseTo(noEvent * RALLY_FACTOR_MIN, 6);
    const big = applyVolatilityTick(100_000, 0, {
      gauss: 0,
      roll: CRASH_CHANCE_HOURLY,
      size: 1,
    });
    expect(big.treasury).toBeCloseTo(noEvent * RALLY_FACTOR_MAX, 6);
  });

  it("never returns a negative treasury", () => {
    const r = applyVolatilityTick(1, -1_000_000, { gauss: -50, roll: 0, size: 0 });
    expect(r.treasury).toBe(0);
  });
});

describe("applyVolatilityTick — Monte-Carlo EV guards", () => {
  it("noise + events are EV-neutral: mean tick factor ≈ fee-only keep", () => {
    const rng = mulberry32(0xb1b);
    const N = 200_000;
    let sum = 0;
    let crashes = 0;
    let rallies = 0;
    for (let i = 0; i < N; i++) {
      const r = applyVolatilityTick(1, 0, draw(rng));
      sum += r.treasury;
      if (r.event === "crash") crashes++;
      if (r.event === "rally") rallies++;
    }
    const mean = sum / N;
    expect(mean).toBeGreaterThan(KEEP_HOURLY - 0.001);
    expect(mean).toBeLessThan(KEEP_HOURLY + 0.001);
    expect(crashes / N).toBeGreaterThan(CRASH_CHANCE_HOURLY * 0.7);
    expect(crashes / N).toBeLessThan(CRASH_CHANCE_HOURLY * 1.3);
    expect(rallies / N).toBeGreaterThan(RALLY_CHANCE_HOURLY * 0.8);
    expect(rallies / N).toBeLessThan(RALLY_CHANCE_HOURLY * 1.2);
  });

  it("drifts down when the casino is quiet (fee dominates)", () => {
    const rng = mulberry32(42);
    let tre = 1_000_000;
    for (let i = 0; i < 24 * 60; i++) {
      tre = applyVolatilityTick(tre, 0, draw(rng)).treasury;
    }
    expect(tre).toBeLessThan(1_000_000);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run tests/unit/stock-tick.test.ts`
Expected: FAIL — cannot resolve `@/lib/stock/tick` and the new config exports.

- [ ] **Step 3: Update `src/lib/stock/config.ts`**

Change the existing fee constant (value `0.01` → `0.02`, mirror note `0055` → `0062`):

```ts
/**
 * Daily management fee ("negative carry"): each day this fraction of the fund's
 * treasury is **burned** (removed from the payout pool), so the price drifts
 * down unless house profit refills it faster. This turns the share from a
 * risk-free hoard into a real bet on casino activity, and is a genuine coin
 * sink. Applied hourly in `snapshot_casino_stock()` as the 1/24 root so it
 * compounds to exactly this rate per day. Mirror in 0062_stock_volatility.sql.
 */
export const MANAGEMENT_FEE_DAILY = 0.02;
```

Add below it (before `MAX_HOLDING_FRACTION`):

```ts
/**
 * Volatility knobs — MIRROR of `snapshot_casino_stock()` in
 * `supabase/migrations/0062_stock_volatility.sql` (SQL is authoritative).
 * Together they make the long-run EV of holding ~neutral: only a slice of
 * casino P&L reaches holders (skim), the noise has arithmetic mean exactly 1,
 * and crash/rally sizes×chances cancel out (EV-0 events).
 */
/** Share of casino P&L (both signs) burned at each hourly fold. */
export const PROFIT_SKIM = 0.75;
/** Lognormal sigma per hourly tick (≈ ±1.6%/hour, ≈ ±8%/day). */
export const NOISE_SD_HOURLY = 0.016;
/** A single noise tick is bounded to ±this fraction. */
export const NOISE_CLAMP = 0.07;
/** Chance per hourly tick of a crash. */
export const CRASH_CHANCE_HOURLY = 0.01;
/** Crash multiplies the treasury by a uniform draw from this range (−45…−20%). */
export const CRASH_FACTOR_MIN = 0.55;
export const CRASH_FACTOR_MAX = 0.8;
/** Chance per hourly tick of a rally. */
export const RALLY_CHANCE_HOURLY = 0.02;
/** Rally multiplies the treasury by a uniform draw from this range (+10…+22.5%). */
export const RALLY_FACTOR_MIN = 1.1;
export const RALLY_FACTOR_MAX = 1.225;
```

- [ ] **Step 4: Create `src/lib/stock/tick.ts`**

```ts
import {
  CRASH_CHANCE_HOURLY,
  CRASH_FACTOR_MAX,
  CRASH_FACTOR_MIN,
  MANAGEMENT_FEE_DAILY,
  NOISE_CLAMP,
  NOISE_SD_HOURLY,
  PROFIT_SKIM,
  RALLY_CHANCE_HOURLY,
  RALLY_FACTOR_MAX,
  RALLY_FACTOR_MIN,
} from "@/lib/stock/config";

/** Random draws for one tick, injected so the math stays deterministic. */
export interface TickRand {
  /** Standard-normal draw for the lognormal noise. */
  gauss: number;
  /** Event roll, uniform [0, 1). */
  roll: number;
  /** Event size draw, uniform [0, 1). */
  size: number;
}

export interface TickResult {
  treasury: number;
  event: "crash" | "rally" | null;
}

/**
 * One hourly volatility fold: profit skim → management fee → lognormal noise
 * (arithmetic mean 1, clamped) → crash/rally roll (EV-0). MIRROR of
 * `snapshot_casino_stock()` in `supabase/migrations/0062_stock_volatility.sql`
 * — SQL is authoritative; this exists for the EV guard tests.
 */
export function applyVolatilityTick(
  treasury: number,
  deltaNet: number,
  rand: TickRand,
): TickResult {
  let tre = treasury + deltaNet * (1 - PROFIT_SKIM);
  tre *= Math.pow(1 - MANAGEMENT_FEE_DAILY, 1 / 24);

  const raw = Math.exp(
    NOISE_SD_HOURLY * rand.gauss - (NOISE_SD_HOURLY * NOISE_SD_HOURLY) / 2,
  );
  tre *= Math.min(1 + NOISE_CLAMP, Math.max(1 - NOISE_CLAMP, raw));

  let event: TickResult["event"] = null;
  if (rand.roll < CRASH_CHANCE_HOURLY) {
    event = "crash";
    tre *= CRASH_FACTOR_MIN + rand.size * (CRASH_FACTOR_MAX - CRASH_FACTOR_MIN);
  } else if (rand.roll < CRASH_CHANCE_HOURLY + RALLY_CHANCE_HOURLY) {
    event = "rally";
    tre *= RALLY_FACTOR_MIN + rand.size * (RALLY_FACTOR_MAX - RALLY_FACTOR_MIN);
  }

  return { treasury: Math.max(0, tre), event };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm exec vitest run tests/unit/stock-tick.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 6: Run the full suite — the fee change must not break existing tests**

Run: `pnpm exec vitest run`
Expected: all green. (`tests/unit/stock.test.ts` does not reference the fee; if anything else asserts `MANAGEMENT_FEE_DAILY === 0.01`, update that expectation to `0.02`.)

- [ ] **Step 7: Commit**

```bash
git add src/lib/stock/config.ts src/lib/stock/tick.ts tests/unit/stock-tick.test.ts
git commit -m "feat(stock): volatility tick mirror + config (skim, 2% fee, noise, events)"
```

---

### Task 2: Migration `0062_stock_volatility.sql`

**Files:**
- Create: `supabase/migrations/0062_stock_volatility.sql`

No runnable local test (migrations are hand-run in the Supabase SQL editor); the TS mirror from Task 1 pins the math. Review the SQL against `src/lib/stock/tick.ts` line by line before committing.

- [ ] **Step 1: Create the migration**

```sql
-- ============================================================================
-- BibSync — BIB-aandeel volatility: the price must also FALL.
--
-- Problem: the stock is a NAV fund on casino house profit, which only grows
-- (house edge), so the chart is a monotone staircase and parking coins in the
-- fund is a guaranteed win. The 1%/day fee (0055) is far smaller than the
-- profit inflow whenever anyone gambles.
--
-- Fix: the hourly fold gains four steps, all plain treasury multipliers so the
-- NAV invariant (price = treasury / shares, payouts covered) holds:
--   1. profit skim  — only 25% of casino P&L (both signs) reaches holders;
--                     the rest is burned. Scales with activity → long-run
--                     EV ~neutral no matter how busy the casino is.
--   2. fee          — raised to 2%/day (hourly root, as in 0055).
--   3. noise        — lognormal, arithmetic mean exactly 1, ±1.6%/h typical,
--                     clamped to ±7%/tick. Independent per tick → no timing
--                     exploit.
--   4. events       — 1%/h crash (×0.55–0.80) or 2%/h rally (×1.10–1.225);
--                     0.01×(0.675−1) + 0.02×(1.1625−1) = 0 → EV-0.
--
-- Event ticks are logged in casino_stock_history.event for chart markers.
-- MIRROR of src/lib/stock/tick.ts + config.ts (this SQL is authoritative).
-- ============================================================================

alter table public.casino_stock_history
  add column if not exists event text
  check (event in ('crash', 'rally'));

create or replace function public.snapshot_casino_stock()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _net    bigint;
  _stock  record;
  _tre    double precision;
  _price  double precision;
  _keep   double precision := power(1 - 0.02, 1.0 / 24);  -- 2%/day fee
  _skim   double precision := 0.75;   -- share of casino P&L burned
  _sd     double precision := 0.016;  -- hourly lognormal sigma
  _z      double precision;
  _factor double precision;
  _roll   double precision;
  _event  text := null;
begin
  select net into _net from public.casino_stats();
  select * into _stock from public.casino_stock where id;

  if _stock.shares > 0 then
    -- 1. fold casino P&L, skimmed to 25% (the skimmed slice is burned)
    _tre := _stock.treasury + (_net - _stock.baseline_net) * (1 - _skim);
    -- 2. management fee (hourly root of the daily rate)
    _tre := _tre * _keep;
    -- 3. lognormal noise, arithmetic mean 1, clamped to ±7% per tick
    --    (1 - random() avoids ln(0); Box–Muller)
    _z := sqrt(-2 * ln(1 - random())) * cos(2 * pi() * random());
    _factor := exp(_sd * _z - _sd * _sd / 2);
    _factor := least(1.07, greatest(0.93, _factor));
    _tre := _tre * _factor;
    -- 4. event roll: 1% crash (−20…−45%), 2% rally (+10…+22.5%) — EV-0
    _roll := random();
    if _roll < 0.01 then
      _event := 'crash';
      _tre := _tre * (0.55 + random() * 0.25);
    elsif _roll < 0.03 then
      _event := 'rally';
      _tre := _tre * (1.10 + random() * 0.125);
    end if;
    _tre := greatest(0, _tre);

    update public.casino_stock
      set treasury = _tre, baseline_net = _net, updated_at = now()
      where id;
    _price := greatest(1, _tre / _stock.shares);
  else
    _price := 100;
  end if;

  insert into public.casino_stock_history (price, shares, net, event)
  values (_price, _stock.shares, _net, _event);
end;
$$;

revoke execute on function public.snapshot_casino_stock() from public, authenticated;
grant execute on function public.snapshot_casino_stock() to service_role;
```

- [ ] **Step 2: Cross-check the SQL against the TS mirror**

Read both files side by side and verify: skim factor `(1 - 0.75)` = `(1 - PROFIT_SKIM)`; keep `power(1 - 0.02, 1.0/24)` = `Math.pow(1 - MANAGEMENT_FEE_DAILY, 1/24)`; sigma `0.016`; clamp `[0.93, 1.07]` = `1 ± NOISE_CLAMP`; crash `0.55 + random()*0.25` spans `[CRASH_FACTOR_MIN, CRASH_FACTOR_MAX]`; rally `1.10 + random()*0.125` spans `[RALLY_FACTOR_MIN, RALLY_FACTOR_MAX]`; thresholds `0.01`/`0.03` = `CRASH_CHANCE_HOURLY` / `CRASH_CHANCE_HOURLY + RALLY_CHANCE_HOURLY`; order skim → fee → noise → event → `greatest(0, …)` identical.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0062_stock_volatility.sql
git commit -m "feat(stock): 0062 volatility — skim, 2% fee, hourly noise, crash/rally events"
```

---

### Task 3: Event in types, history query, chart markers, copy

**Files:**
- Modify: `src/lib/stock/types.ts` (StockTick)
- Modify: `src/types/database.ts:1125-1148` (casino_stock_history)
- Modify: `src/lib/stock/queries.ts:74-90` (getStockHistory)
- Modify: `src/components/stock/price-chart.tsx` (event dots)
- Modify: `src/lib/copy.ts:711-746` (two strings in the `stock` block)

- [ ] **Step 1: Extend `StockTick` in `src/lib/stock/types.ts`**

Replace the existing interface:

```ts
/** One point on the price chart. */
export interface StockTick {
  price: number;
  recordedAt: string;
  /** Hourly tick that was a crash or rally (chart marker), else null. */
  event: "crash" | "rally" | null;
}
```

- [ ] **Step 2: Add `event` to `casino_stock_history` in `src/types/database.ts`**

In the `casino_stock_history` block (~line 1125), add to `Row`:

```ts
          event: string | null;
```

and to both `Insert` and `Update`:

```ts
          event?: string | null;
```

- [ ] **Step 3: Select + map the column in `getStockHistory` (`src/lib/stock/queries.ts`)**

Replace the function body's select and mapping:

```ts
/** Recent price ticks (oldest → newest) for the chart. */
export async function getStockHistory(limit = 48): Promise<StockTick[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("casino_stock_history")
    .select("price, recorded_at, event")
    .order("recorded_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[getStockHistory]", error);
    return [];
  }
  return (data ?? [])
    .map((r) => ({
      price: Number(r.price),
      recordedAt: r.recorded_at,
      event: r.event === "crash" || r.event === "rally" ? r.event : null,
    }))
    .reverse();
}
```

- [ ] **Step 4: Add the Dutch copy**

In `src/lib/copy.ts`, inside the `stock` block (after `empty`), add:

```ts
    crashMark: "📉 Beurscrash",
    rallyMark: "📈 Rally",
```

And replace the `hint` line so it tells the truth about the new mechanics:

```ts
    hint: "De koers volgt deels de winst van het casino, maar schommelt elk uur mee met de markt — en af en toe crasht of rallyt hij hard.",
```

- [ ] **Step 5: Draw event dots in `src/components/stock/price-chart.tsx`**

After the `<polyline …/>` element (so dots render on top), add:

```tsx
      {ticks.map((t, i) =>
        t.event ? (
          // Zero-length round-capped path = a dot that ignores the
          // preserveAspectRatio="none" stretch (vectorEffect keeps it round).
          <path
            key={i}
            d={`M ${x(i)} ${y(t.price)} l 0.01 0`}
            stroke={t.event === "crash" ? "rgb(239,68,68)" : "rgb(34,197,94)"}
            strokeWidth="7"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          >
            <title>
              {t.event === "crash" ? copy.stock.crashMark : copy.stock.rallyMark}
            </title>
          </path>
        ) : null,
      )}
```

- [ ] **Step 6: Gates**

Run: `pnpm exec tsc --noEmit` → only the 4 known baseline errors.
Run: `pnpm lint` → clean.
Run: `pnpm exec vitest run` → all green.

- [ ] **Step 7: Commit**

```bash
git add src/lib/stock/types.ts src/types/database.ts src/lib/stock/queries.ts src/lib/copy.ts src/components/stock/price-chart.tsx
git commit -m "feat(stock): crash/rally markers on the price chart"
```

---

### Task 4: Docs (CLAUDE.md) + final verification

**Files:**
- Modify: `CLAUDE.md` (migration list, after the `0061_theft_debt.sql` item)

- [ ] **Step 1: Add the migration list entry**

In `CLAUDE.md`, directly after item 26 (`0061_theft_debt.sql`), add:

```markdown
27. `0062_stock_volatility.sql` — **BIB-aandeel volatility**: the hourly
    `snapshot_casino_stock()` fold now applies a 75% profit skim (only 25% of
    casino P&L reaches holders), a 2%/day fee, EV-neutral lognormal noise
    (±1.6%/h, clamped ±7%) and EV-0 crash/rally events (1%/h ×0.55–0.80,
    2%/h ×1.10–1.225) logged in `casino_stock_history.event` and marked on
    the chart. Pure mirror + Monte-Carlo EV guards in `src/lib/stock/tick.ts`;
    constants in `src/lib/stock/config.ts` (SQL authoritative).
```

- [ ] **Step 2: Final gates**

Run: `pnpm exec tsc --noEmit` → only the 4 known baseline errors.
Run: `pnpm lint` → clean.
Run: `pnpm exec vitest run` → all green.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: 0062 stock volatility in migration list"
```
