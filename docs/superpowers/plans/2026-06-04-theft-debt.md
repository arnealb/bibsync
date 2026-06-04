# Theft Debt + Stock Seizure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A caught thief always pays the full 2× penalty — wallet first, then a forced sale of their casino stock, and whatever remains becomes wallet debt that garnishes half of all future income until repaid.

**Architecture:** A `wallets.debt` column plus a `BEFORE UPDATE OF bibcoins` trigger on `wallets` that burns half of every credit while debt is outstanding (the trigger is the only choke point that also covers the six SQL functions that credit wallets directly). `claimRobbed` gains a seizure step that mirrors `sellStock`'s version-guarded fund math. Stealing is blocked while in debt; the header balance shows a red debt chip via the existing wallet realtime subscription.

**Tech Stack:** Next.js 16 Server Actions, Supabase (Postgres SECURITY DEFINER functions + trigger, manual migration), vitest for pure helpers.

**Spec:** `docs/superpowers/specs/2026-06-04-theft-debt-design.md`

**Conventions that apply everywhere in this plan** (from CLAUDE.md):
- Code and comments in English; all Dutch user-facing strings go in `src/lib/copy.ts`.
- `pnpm` for everything. Local `pnpm build` may fail on `next/font` (sandboxed Google Fonts fetch) — verify with `pnpm exec tsc --noEmit` + `pnpm lint` + `pnpm test` instead.
- Migrations are NOT run by you — the owner runs them manually in the Supabase SQL editor. Your job is only to write the file.
- Never import server-only modules (`@/lib/supabase/admin`, `@/lib/auth`) into client components.

---

### Task 1: Pure helpers — `garnishSplit`, `isGarnishExempt`, `sharesToCover` (TDD)

**Files:**
- Create: `src/lib/theft/debt.ts`
- Create: `src/lib/theft/seizure.ts`
- Test: `tests/unit/theft-debt.test.ts`
- Test: `tests/unit/theft-seizure.test.ts`

These are pure mirrors of SQL rules (the codebase convention — cf. "MIRROR of CASINO_*_REASONS" in `supabase/migrations/0050_casino_stock.sql`) plus one helper used by the seizure code in Task 5.

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/theft-debt.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { garnishSplit, isGarnishExempt } from "@/lib/theft/debt";

describe("garnishSplit", () => {
  it("takes half of a credit while in debt", () => {
    expect(garnishSplit(100, 1000)).toEqual({ kept: 50, garnished: 50 });
  });

  it("rounds the garnish down (the user keeps the odd coin)", () => {
    expect(garnishSplit(5, 1000)).toEqual({ kept: 3, garnished: 2 });
    expect(garnishSplit(1, 1000)).toEqual({ kept: 1, garnished: 0 });
  });

  it("never takes more than the remaining debt", () => {
    expect(garnishSplit(100, 30)).toEqual({ kept: 70, garnished: 30 });
  });

  it("is a no-op without debt", () => {
    expect(garnishSplit(100, 0)).toEqual({ kept: 100, garnished: 0 });
  });

  it("is a no-op for a non-positive amount", () => {
    expect(garnishSplit(0, 500)).toEqual({ kept: 0, garnished: 0 });
  });
});

describe("isGarnishExempt", () => {
  it("exempts refund-style reasons", () => {
    expect(isGarnishExempt("stock_refund")).toBe(true);
    expect(isGarnishExempt("name-change-refund")).toBe(true);
    expect(isGarnishExempt("theft_loss_refund")).toBe(true);
    expect(isGarnishExempt("crate_dup")).toBe(true);
    expect(isGarnishExempt("theft_seizure")).toBe(true);
  });

  it("garnishes ordinary income", () => {
    expect(isGarnishExempt("hourly")).toBe(false);
    expect(isGarnishExempt("stock_sell")).toBe(false);
    expect(isGarnishExempt("theft_gain")).toBe(false);
    expect(isGarnishExempt("blackjack_payout")).toBe(false);
  });
});
```

Create `tests/unit/theft-seizure.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { sharesToCover } from "@/lib/theft/seizure";

describe("sharesToCover", () => {
  it("rounds up so the shortfall is fully covered", () => {
    expect(sharesToCover(250, 100, 10)).toBe(3); // 3 × 100 ≥ 250
  });

  it("covers an exact multiple without overselling", () => {
    expect(sharesToCover(300, 100, 10)).toBe(3);
  });

  it("is capped at the held shares", () => {
    expect(sharesToCover(10_000, 100, 4)).toBe(4);
  });

  it("sells nothing at a zero or negative price", () => {
    expect(sharesToCover(500, 0, 10)).toBe(0);
    expect(sharesToCover(500, -1, 10)).toBe(0);
  });

  it("sells nothing without a shortfall or without shares", () => {
    expect(sharesToCover(0, 100, 10)).toBe(0);
    expect(sharesToCover(500, 100, 0)).toBe(0);
  });

  it("handles fractional NAV prices", () => {
    expect(sharesToCover(100, 33.4, 10)).toBe(3); // ceil(100 / 33.4) = 3
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run tests/unit/theft-debt.test.ts tests/unit/theft-seizure.test.ts`
Expected: FAIL — `Cannot find module '@/lib/theft/debt'` (and `.../seizure`).

- [ ] **Step 3: Implement the helpers**

Create `src/lib/theft/debt.ts`:

```ts
/**
 * Theft-debt helpers. These MIRROR the SQL in
 * supabase/migrations/0061_theft_debt.sql — the SQL is authoritative; keep
 * both in sync when tuning.
 */

/**
 * Split a wallet credit between the user and their outstanding debt: half of
 * every credit (rounded down, capped at the remaining debt) is garnished —
 * burned — until the debt is gone. Mirror of garnish_wallet_credit().
 */
export function garnishSplit(
  amount: number,
  debt: number,
): { kept: number; garnished: number } {
  if (amount <= 0 || debt <= 0) return { kept: amount, garnished: 0 };
  const garnished = Math.min(debt, Math.floor(amount / 2));
  return { kept: amount - garnished, garnished };
}

/**
 * Award reasons the garnish trigger skips: refunds give back coins the user
 * already had, they are not income. Mirror of the predicate in
 * award_bibcoins() (migration 0061).
 */
export function isGarnishExempt(reason: string): boolean {
  return (
    reason.includes("refund") ||
    reason === "crate_dup" ||
    reason === "theft_seizure"
  );
}
```

Create `src/lib/theft/seizure.ts`:

```ts
/**
 * How many shares to force-sell to recover `shortfall` bibcoins at the current
 * NAV sell price. Rounds up (one share too many beats one too few — the excess
 * change stays in the thief's wallet) and is capped at what they actually
 * hold. A price of 0 (fund underwater / no shares) can recover nothing.
 */
export function sharesToCover(
  shortfall: number,
  price: number,
  heldShares: number,
): number {
  if (shortfall <= 0 || price <= 0 || heldShares <= 0) return 0;
  return Math.min(heldShares, Math.ceil(shortfall / price));
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run tests/unit/theft-debt.test.ts tests/unit/theft-seizure.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/theft/debt.ts src/lib/theft/seizure.ts tests/unit/theft-debt.test.ts tests/unit/theft-seizure.test.ts
git commit -m "feat(theft): pure debt-garnish + stock-seizure helpers"
```

---

### Task 2: Migration `0061_theft_debt.sql`

**Files:**
- Create: `supabase/migrations/0061_theft_debt.sql`

The owner runs this manually in the Supabase SQL editor (single transaction). Notes that informed the SQL below — do not "fix" these:
- `create or replace function` **preserves existing grants**, so `award_bibcoins` needs no re-grant. Its signature must NOT change (a new default param would create a second overload and strand the SQL callers in `0044`/`0045`/`0047`/`0051`/`0060` on the old one).
- The trigger is `BEFORE UPDATE OF bibcoins` — it fires only when `bibcoins` is in the SET list, so `claimRobbed`'s debt-increment update (`set debt = …`) does not fire it, and a no-op upsert passes through via the `_gain <= 0` early return.
- The ledger reason is `theft_debt_repayment`: the `theft_` prefix matches `THEFT_REASON_PREFIX` in `src/lib/theft/config.ts`, which keeps forced repayments out of the "did the victim spend since the steal" claim-window check in `claimRobbed`.
- The exempt-reason predicate MIRRORS `isGarnishExempt()` from Task 1.

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/0061_theft_debt.sql` with exactly:

```sql
-- ============================================================================
-- BibSync — theft debt + stock seizure (counter to the "park the loot in
-- aandelen" exploit).
--
-- A caught thief who can't cover the 2× penalty from their wallet now (1) has
-- their casino stock force-sold (handled in the claimRobbed action) and (2)
-- carries the rest as wallet debt. While in debt, HALF of every wallet credit
-- is garnished — burned, offsetting the victim payout that was minted — until
-- the debt is repaid.
--
-- Garnishment runs as a BEFORE UPDATE trigger on wallets so it covers every
-- credit path: the award_bibcoins RPC, but also the functions that credit
-- wallets directly (claim_hourly_bibcoins, claim_daily_bibcoins + quests,
-- transfer_bibcoins, the strijder bonus, record_screen_time) and any future
-- ones. Refund-style awards are NOT garnished (giving a stake back is not
-- income): award_bibcoins knows the reason and flags those to the trigger via
-- a transaction-local setting.
--
-- MIRRORS in src/lib/theft/debt.ts: garnishSplit() ↔ the trigger math,
-- isGarnishExempt() ↔ the exempt predicate in award_bibcoins.
-- ============================================================================

alter table public.wallets
  add column if not exists debt integer not null default 0;

do $$ begin
  alter table public.wallets
    add constraint wallets_debt_nonnegative check (debt >= 0);
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- garnish_wallet_credit() — when bibcoins increase on a wallet that carries
-- debt, burn half the increase (floored, capped at the remaining debt) unless
-- the transaction flagged itself exempt. Logged as a 'theft_debt_repayment'
-- ledger row: the theft_ prefix keeps it out of the "did the victim spend
-- since the steal" check in claimRobbed.
-- ----------------------------------------------------------------------------
create or replace function public.garnish_wallet_credit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _gain    integer;
  _garnish integer;
begin
  _gain := new.bibcoins - old.bibcoins;
  if _gain <= 0 or coalesce(old.debt, 0) <= 0 then
    return new;
  end if;
  if coalesce(current_setting('bibsync.skip_garnish', true), '') = '1' then
    return new;
  end if;

  _garnish := least(old.debt, floor(_gain / 2.0)::integer);
  if _garnish <= 0 then
    return new;
  end if;

  new.bibcoins := new.bibcoins - _garnish;
  new.debt     := old.debt - _garnish;

  insert into public.bibcoin_transactions (user_id, amount, reason, ref_key)
  values (
    new.user_id, -_garnish, 'theft_debt_repayment',
    extract(epoch from clock_timestamp())::text
  )
  on conflict (user_id, reason, ref_key) do nothing;

  return new;
end;
$$;

drop trigger if exists wallets_garnish_credit on public.wallets;
create trigger wallets_garnish_credit
  before update of bibcoins on public.wallets
  for each row
  execute function public.garnish_wallet_credit();

-- ----------------------------------------------------------------------------
-- award_bibcoins — same signature and behaviour as 0019, but refund-style
-- awards flag the garnish trigger to skip. The flag is reset right after the
-- wallet update so it can never leak to a later credit in the same
-- transaction. (create or replace preserves the existing grants.)
-- ----------------------------------------------------------------------------
create or replace function public.award_bibcoins(
  _user_id uuid,
  _amount integer,
  _reason text,
  _ref text default ''
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.bibcoin_transactions (user_id, amount, reason, ref_key)
  values (_user_id, _amount, _reason, coalesce(_ref, ''))
  on conflict (user_id, reason, ref_key) do nothing;

  if not found then
    return false; -- already awarded for this (reason, ref)
  end if;

  -- MIRROR: isGarnishExempt() in src/lib/theft/debt.ts.
  if _reason like '%refund%' or _reason in ('crate_dup', 'theft_seizure') then
    perform set_config('bibsync.skip_garnish', '1', true);
  end if;

  insert into public.wallets (user_id, bibcoins)
  values (_user_id, 2000 + _amount)
  on conflict (user_id) do update
    set bibcoins = public.wallets.bibcoins + _amount;

  perform set_config('bibsync.skip_garnish', '', true);
  return true;
end;
$$;

-- ----------------------------------------------------------------------------
-- add_wallet_debt — atomically put a user in (deeper) debt. Service-only;
-- used by claimRobbed for whatever the wallet drain + stock seizure did not
-- cover.
-- ----------------------------------------------------------------------------
create or replace function public.add_wallet_debt(
  _user_id uuid,
  _amount integer
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if _amount is null or _amount <= 0 then
    return;
  end if;
  insert into public.wallets (user_id) values (_user_id)
  on conflict (user_id) do nothing;
  update public.wallets set debt = debt + _amount where user_id = _user_id;
end;
$$;

revoke execute on function public.add_wallet_debt(uuid, integer) from public, authenticated;
grant execute on function public.add_wallet_debt(uuid, integer) to service_role;
```

- [ ] **Step 2: Sanity-check the file**

Re-read the file and verify: (a) `award_bibcoins` parameter list is identical to `0019_bibcoins.sql:86-91` (`_user_id uuid, _amount integer, _reason text, _ref text default ''`), (b) the trigger reads `old.debt`/writes `new.debt` (never `update wallets` inside the trigger — that would recurse), (c) the exempt list matches `isGarnishExempt` from Task 1 exactly.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0061_theft_debt.sql
git commit -m "feat(theft): migration 0061 — wallets.debt, garnish trigger, add_wallet_debt"
```

---

### Task 3: DB types + server wrappers (`addWalletDebt`, `getWallet`)

**Files:**
- Modify: `src/types/database.ts:504-527` (wallets Row/Insert/Update) and `:1194-1224` (Functions)
- Modify: `src/lib/bibcoins/award.ts` (add `addWalletDebt`)
- Modify: `src/lib/bibcoins/queries.ts` (add `getWallet`)

- [ ] **Step 1: Add `debt` to the wallets types**

In `src/types/database.ts`, the `wallets` table (around line 504) — add `debt` to all three shapes:

```ts
      wallets: {
        Row: {
          user_id: string;
          bibcoins: number;
          last_hourly_at: Timestamp;
          last_daily_on: string | null;
          daily_streak: number;
          debt: number;
        };
        Insert: {
          user_id: string;
          bibcoins?: number;
          last_hourly_at?: Timestamp;
          last_daily_on?: string | null;
          daily_streak?: number;
          debt?: number;
        };
        Update: {
          user_id?: string;
          bibcoins?: number;
          last_hourly_at?: Timestamp;
          last_daily_on?: string | null;
          daily_streak?: number;
          debt?: number;
        };
        Relationships: [];
      };
```

- [ ] **Step 2: Add the `add_wallet_debt` RPC to the Functions block**

In the same file, directly after the `claim_hourly_bibcoins` entry (around line 1224), add:

```ts
      add_wallet_debt: {
        Args: { _user_id: string; _amount: number };
        Returns: undefined;
      };
```

- [ ] **Step 3: Add the `addWalletDebt` wrapper**

In `src/lib/bibcoins/award.ts`, after `spendBibcoins` (line 54), add:

```ts
/**
 * Put a user in (deeper) debt: half of their future income is garnished until
 * the debt is repaid (migration 0061). Used for the uncovered part of a
 * caught-thief penalty.
 */
export async function addWalletDebt(
  userId: string,
  amount: number,
): Promise<void> {
  if (amount <= 0) return;
  const admin = createAdminClient();
  if (!admin) return;
  const { error } = await admin.rpc("add_wallet_debt", {
    _user_id: userId,
    _amount: amount,
  });
  if (error) console.error("[addWalletDebt]", error);
}
```

- [ ] **Step 4: Add the `getWallet` query**

In `src/lib/bibcoins/queries.ts`, after `getBibcoins` (line 58), add:

```ts
/** The current user's balance + outstanding theft debt (RLS: own row only). */
export async function getWallet(
  userId: string,
): Promise<{ bibcoins: number; debt: number }> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("wallets")
    .select("bibcoins, debt")
    .eq("user_id", userId)
    .maybeSingle();
  return { bibcoins: data?.bibcoins ?? BIBCOINS_START, debt: data?.debt ?? 0 };
}
```

- [ ] **Step 5: Verify it compiles**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/types/database.ts src/lib/bibcoins/award.ts src/lib/bibcoins/queries.ts
git commit -m "feat(theft): debt column types + addWalletDebt/getWallet wrappers"
```

---

### Task 4: Block stealing while in debt (action + UI) and the debt copy

**Files:**
- Modify: `src/lib/copy.ts:681-706` (the `theft` section)
- Modify: `src/app/_actions/theft.ts:37-50` (`stealCoins` guard)
- Modify: `src/app/app/users/[id]/page.tsx:74-79,122-135` (pass the viewer's debt)
- Modify: `src/components/bibcoins/steal-bibcoins.tsx` (disable + explain)

- [ ] **Step 1: Add the Dutch copy**

In `src/lib/copy.ts`, inside the `theft: {` block, after the `falseClaim` entry (line 705), add:

```ts
    debtBlocked:
      "Je staat in het rood — betaal eerst je schuld af voor je weer steelt.",
    debtHint:
      "Schuld: de helft van je inkomsten wordt afgeroomd tot dit 0 is.",
```

(`debtHint` is used by Task 6's header chip — both strings land in one copy edit.)

- [ ] **Step 2: Guard `stealCoins`**

In `src/app/_actions/theft.ts`, inside `stealCoins`, directly after the self-steal check (line 50), add:

```ts
  // A thief in debt can't steal — repayment first. Otherwise stealing while
  // broke is just a loan at 50% interest (the garnish would take half).
  const { data: thiefWallet } = await admin
    .from("wallets")
    .select("debt")
    .eq("user_id", thiefId)
    .maybeSingle();
  if ((thiefWallet?.debt ?? 0) > 0) {
    return { ok: false, error: copy.theft.debtBlocked };
  }
```

- [ ] **Step 3: Pass the viewer's debt to the steal button**

In `src/app/app/users/[id]/page.tsx`:

Replace the import on line 9:

```ts
import { getWallet } from "@/lib/bibcoins/queries";
```

Replace the `Promise.all` block (lines 74-79):

```ts
  const [stats, ownedIds, loadoutRow, myWallet] = await Promise.all([
    getProfileStats(id),
    getOwnedCosmetics(id),
    getLoadout(id),
    isSelf ? Promise.resolve({ bibcoins: 0, debt: 0 }) : getWallet(ctx.user.id),
  ]);
```

Update the two usages (lines 124-133): `GiftBibcoins` gets `myBalance={myWallet.bibcoins}`, and `StealBibcoins` gains the new prop:

```tsx
            <GiftBibcoins
              recipientId={id}
              recipientName={profile.display_name}
              myBalance={myWallet.bibcoins}
            />
            <StealBibcoins
              victimId={id}
              victimName={profile.display_name}
              victimBalance={stats.bibcoins}
              viewerDebt={myWallet.debt}
            />
```

- [ ] **Step 4: Disable + explain in `StealBibcoins`**

In `src/components/bibcoins/steal-bibcoins.tsx`, add the optional prop and wire it into the trigger button:

```tsx
/** "Stelen" button + dialog on another user's profile. */
export function StealBibcoins({
  victimId,
  victimName,
  victimBalance,
  viewerDebt = 0,
}: {
  victimId: string;
  victimName: string;
  victimBalance: number;
  viewerDebt?: number;
}) {
```

And change the trigger `<Button>` (lines 61-69) to:

```tsx
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 border-red-500/40 text-red-600 hover:bg-red-500/10 dark:text-red-400"
            disabled={victimBalance < 1 || viewerDebt > 0}
            title={viewerDebt > 0 ? copy.theft.debtBlocked : undefined}
          >
            <Grab className="size-4" />
            {copy.theft.button}
          </Button>
```

- [ ] **Step 5: Verify**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: both clean.

- [ ] **Step 6: Commit**

```bash
git add src/lib/copy.ts src/app/_actions/theft.ts "src/app/app/users/[id]/page.tsx" src/components/bibcoins/steal-bibcoins.tsx
git commit -m "feat(theft): block stealing while in debt"
```

---

### Task 5: Seizure + debt booking in `claimRobbed`

**Files:**
- Modify: `src/app/_actions/theft.ts` (imports, new `seizeStockValue` helper, the caught-loop at lines 197-212)

- [ ] **Step 1: Extend the imports**

In `src/app/_actions/theft.ts`, update the existing import lines (top of file) to:

```ts
import { addWalletDebt, awardBibcoins, spendBibcoins } from "@/lib/bibcoins/award";
```

and add (keeping the existing import order style — `@/lib/...` group):

```ts
import { applySell, sellPrice, sharePrice } from "@/lib/stock/engine";
import { getCasinoStats, getStockState } from "@/lib/stock/queries";
import { sharesToCover } from "@/lib/theft/seizure";
```

(`sharePrice` is for the best-effort price tick in Step 2.)

- [ ] **Step 2: Add the `seizeStockValue` helper**

In the same file, after the `walletBalance` helper (line 34), add:

```ts
/**
 * Force-sell a caught thief's casino shares to cover what their wallet
 * couldn't pay of the penalty. Mirrors sellStock's version-guarded fund math;
 * a lost race recovers nothing and the caller books the full shortfall as
 * debt instead (the victim's claim must never fail on a busy fund). The gross
 * proceeds land in the wallet garnish-exempt ('theft_seizure') and the
 * covered slice immediately leaves again as 'theft_caught', so the ledger
 * stays balanced and the change from an over-sold share stays with the thief.
 * Returns the amount actually recovered.
 */
async function seizeStockValue(
  admin: SupabaseClient,
  thiefId: string,
  shortfall: number,
  theftId: string,
): Promise<number> {
  const { data: h } = await admin
    .from("casino_holdings")
    .select("shares, cost_basis")
    .eq("user_id", thiefId)
    .maybeSingle();
  const held = h?.shares ?? 0;
  if (held <= 0) return 0;

  const { net } = await getCasinoStats(admin);
  const state = await getStockState(admin);
  const qty = sharesToCover(shortfall, sellPrice(state, net), held);
  if (qty <= 0) return 0;

  const { state: next, proceeds } = applySell(state, net, qty);

  const { data: updated } = await admin
    .from("casino_stock")
    .update({
      shares: next.shares,
      treasury: next.treasury,
      baseline_net: net,
      version: state.version + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", true)
    .eq("version", state.version)
    .select("version");
  if (!updated || updated.length === 0) return 0; // lost the race → all debt

  const oldBasis = Number(h?.cost_basis ?? 0);
  const newShares = held - qty;
  const newBasis =
    newShares <= 0
      ? 0
      : Math.max(0, oldBasis - Math.round((oldBasis * qty) / held));
  await admin.from("casino_holdings").upsert({
    user_id: thiefId,
    shares: newShares,
    cost_basis: newBasis,
    updated_at: new Date().toISOString(),
  });

  // Best-effort price tick, like sellStock's recordTick.
  const { error: tickError } = await admin.from("casino_stock_history").insert({
    price: sharePrice(next, net),
    shares: next.shares,
    net,
  });
  if (tickError) console.error("[seizeStockValue] tick", tickError);

  if (proceeds <= 0) return 0;
  await awardBibcoins(thiefId, proceeds, "theft_seizure", `seizure:${theftId}`);
  const covered = Math.min(proceeds, shortfall);
  const taken = await spendBibcoins(
    thiefId,
    covered,
    "theft_caught",
    `caught:${theftId}:seizure`,
  );
  return taken ? covered : 0;
}
```

- [ ] **Step 3: Rework the caught-loop**

Replace the loop body in `claimRobbed` (currently lines 201-212):

```ts
  let reward = 0;
  for (const t of claimable) {
    const penalty = t.amount * CAUGHT_MULTIPLIER;
    // Read the thief's *real* balance with the service role, then take the most
    // of the 2× they can cover so the spend succeeds instead of failing.
    const thiefBalance = await walletBalance(admin, t.thiefId);
    const take = Math.min(penalty, thiefBalance);
    if (take > 0) {
      await spendBibcoins(t.thiefId, take, "theft_caught", `caught:${t.id}`);
    }
    // Whatever the wallet couldn't cover comes out of their aandelen; the
    // rest becomes debt that garnishes half of all future income (0061).
    let shortfall = penalty - take;
    if (shortfall > 0) {
      shortfall -= await seizeStockValue(admin, t.thiefId, shortfall, t.id);
    }
    if (shortfall > 0) {
      await addWalletDebt(t.thiefId, shortfall);
    }
    reward += penalty;
  }
```

(The victim payout below the loop — `reward` awarded as `theft_reward` — stays exactly as it is.)

- [ ] **Step 4: Verify**

Run: `pnpm exec tsc --noEmit && pnpm test`
Expected: tsc clean; all vitest suites pass (the stock engine tests in `tests/unit/stock.test.ts` are untouched).

- [ ] **Step 5: Commit**

```bash
git add src/app/_actions/theft.ts
git commit -m "feat(theft): seize aandelen + book debt when a caught thief can't pay"
```

---

### Task 6: Red debt chip next to the header balance

**Files:**
- Modify: `src/hooks/use-bibcoins-realtime.ts` (pass `debt` through)
- Modify: `src/components/bibcoins/bibcoins-balance.tsx` (chip)
- Modify: `src/components/app/app-header.tsx` (seed debt server-side)

The `wallets` realtime payload already contains the whole row, so the new column rides along for free. The other two `useBibcoinsRealtime` callers (`blackjack-panel.tsx:208`, `roulette-panel.tsx:126`) pass `setBalance` and stay compiling because the extra callback parameter is optional.

- [ ] **Step 1: Extend the hook**

In `src/hooks/use-bibcoins-realtime.ts`, change the signature (line 21-24) to:

```ts
export function useBibcoinsRealtime(
  userId: string,
  onBalance: (bibcoins: number, debt?: number) => void,
) {
```

and the event handler (lines 49-53) to:

```ts
          (p) => {
            const row = p.new as { bibcoins?: number; debt?: number } | null;
            if (row && typeof row.bibcoins === "number")
              ref.current(
                row.bibcoins,
                typeof row.debt === "number" ? row.debt : undefined,
              );
          },
```

- [ ] **Step 2: Render the chip**

Replace the body of `src/components/bibcoins/bibcoins-balance.tsx`'s component with:

```tsx
export function BibcoinsBalance({
  userId,
  initialBalance,
  initialDebt = 0,
}: {
  userId: string;
  initialBalance: number;
  initialDebt?: number;
}) {
  const [balance, setBalance] = useState(initialBalance);
  const [debt, setDebt] = useState(initialDebt);
  useBibcoinsRealtime(userId, (bibcoins, nextDebt) => {
    setBalance(bibcoins);
    if (typeof nextDebt === "number") setDebt(nextDebt);
  });

  return (
    <Button
      render={<Link href="/app/shop" />}
      nativeButton={false}
      variant="ghost"
      size="sm"
      className="gap-1.5 font-mono tabular-nums"
      aria-label={copy.bibcoins.shop.nav}
    >
      <Coins className="size-4 text-amber-500" />
      {balance}
      {debt > 0 && (
        <span
          className="font-semibold text-red-600 dark:text-red-400"
          title={copy.theft.debtHint}
        >
          −{debt}
        </span>
      )}
    </Button>
  );
}
```

(Imports are unchanged; the component's doc comment stays.)

- [ ] **Step 3: Seed the debt server-side**

In `src/components/app/app-header.tsx`:

Replace the `getBibcoins` import (line 11) with:

```ts
import { getWallet } from "@/lib/bibcoins/queries";
```

Replace lines 19-21:

```ts
  const [wallet, loadout] = ctx
    ? await Promise.all([getWallet(ctx.user.id), getLoadout(ctx.user.id)])
    : [{ bibcoins: 0, debt: 0 }, null];
```

And the `BibcoinsBalance` usage (line 36):

```tsx
          <BibcoinsBalance
            userId={ctx?.user.id ?? ""}
            initialBalance={wallet.bibcoins}
            initialDebt={wallet.debt}
          />
```

- [ ] **Step 4: Verify**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: both clean (blackjack/roulette panels compile untouched).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/use-bibcoins-realtime.ts src/components/bibcoins/bibcoins-balance.tsx src/components/app/app-header.tsx
git commit -m "feat(theft): red debt chip next to the header bibcoins balance"
```

---

### Task 7: Document in CLAUDE.md + full verification

**Files:**
- Modify: `CLAUDE.md` (migrations list + domain rules)

- [ ] **Step 1: Add the migration to the data-model list**

In `CLAUDE.md`, after the `0036_mines.sql` entry (item 25 in the migrations list), add:

```markdown
26. `0061_theft_debt.sql` — **theft debt**: `wallets.debt` + the
    `wallets_garnish_credit` BEFORE-UPDATE trigger (burns half of every wallet
    credit while `debt > 0`; refund-style awards exempt — mirror
    `isGarnishExempt` in `src/lib/theft/debt.ts`) + `add_wallet_debt` RPC.
```

- [ ] **Step 2: Add the domain rule**

In `CLAUDE.md`'s "Domain rules worth knowing", after the **Schandpaal** bullet, add:

```markdown
- **Stelen-schuld:** a caught thief owes 2×. Collection order: wallet drain →
  forced sale of their BIB-aandelen (`seizeStockValue` in `_actions/theft.ts`,
  version-guarded like `sellStock`; a lost race skips seizure) → the rest
  becomes `wallets.debt`. While `debt > 0` the garnish trigger burns **half of
  every wallet credit** (ledger reason `theft_debt_repayment` — the `theft_`
  prefix keeps it out of the claim-window spend check), stealing is blocked
  (`copy.theft.debtBlocked`), and the header balance shows a red `−debt` chip.
  The victim is still paid the full 2× instantly; garnished coins are burned
  to offset that mint.
```

- [ ] **Step 3: Full verification**

Run: `pnpm test && pnpm exec tsc --noEmit && pnpm lint`
Expected: all suites pass, tsc clean, lint clean.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: theft debt + seizure in CLAUDE.md"
```

---

## Deploy note (for the owner, not the executor)

Run `supabase/migrations/0061_theft_debt.sql` in the Supabase SQL editor **before** the app deploy lands. Order is safe in both directions for reads (inserts tolerate the column existing first; old app code ignores `debt`), but the new `stealCoins`/`claimRobbed`/`getWallet` code selects `debt` and calls `add_wallet_debt`, so the migration must be in place by the time the new code serves traffic.
