# Theft debt & stock seizure — design

**Date:** 2026-06-04
**Status:** approved (brainstorm with owner)

## Problem

Getting caught stealing is free if your wallet is empty. The caught-penalty in
`claimRobbed` (`src/app/_actions/theft.ts:206-211`) is best-effort: it clamps
the 2× penalty to the thief's wallet balance and silently skips when that is 0.
Stocks (`casino_holdings`, migration `0050`) live outside the wallet and no
server-side path can touch them. So: steal 10 000 → buy stock with everything →
wallet = 0 → get caught → lose nothing, keep the loot in shares.

Stocks are not the only shelter — poker chips, transfers (`0037`) and plain
spending hide coins the same way — so the fix must not be "block stock buys".
Additionally, the victim is always paid the full 2× (minted from nothing), so
every uncollectable penalty inflates the economy.

## Goals

- A caught thief always pays the full 2× penalty eventually, no matter where
  the coins were parked.
- Victim UX unchanged: full 2× paid out instantly.
- The burned debt repayments offset the minted victim payout over time.
- Debt is visible to its owner; you cannot steal while in debt.

## Non-goals

- No drip payout to the victim (rejected: complexity).
- No freezing/seizing of poker chips at catch time (debt catches the cash-out).
- No public shaming of debtors, no pillory link.
- No blocking of stock buys or other "shelter" actions while a theft is open.

## Design

### 1. Migration `supabase/migrations/0061_theft_debt.sql`

- `alter table public.wallets add column debt integer not null default 0
  check (debt >= 0);` (wallets is already in the realtime publication, so the
  column rides along in existing wallet events).
- Replace `award_bibcoins` with a new signature
  `award_bibcoins(p_user uuid, p_amount int, p_reason text, p_ref text,
  p_garnish boolean default true)`:
  - Idempotency check on `p_ref` stays exactly as today, and stays first.
  - After the check, when `p_garnish` and `debt > 0`:
    `garnish := least(debt, floor(p_amount / 2.0))` — wallet is credited
    `p_amount - garnish`, `debt` decreases by `garnish`. The garnished coins
    are **burned** (no counter-credit anywhere) to offset the minted victim
    payout.
  - The garnish is recorded as its own ledger row (`reason 'debt_repayment'`,
    `ref p_ref || ':garnish'`, in the same transaction as the award row), so
    the audit trail shows gross award + repayment. Because it runs inside the
    award's idempotency guard, a retried ref can never double-garnish.
  - `default true` keeps every existing caller (TS actions, `claim_hourly`,
    the King crons `0047`/`0051`/`0060`, transfers `0037`) garnishing without
    edits — SQL is the only choke point that covers cron-side awards.
- Grants unchanged: revoked from `authenticated`, granted to `service_role`
  (same as `0019`).

### 2. Seizure + debt in `claimRobbed` (`src/app/_actions/theft.ts`)

After the existing wallet drain (`take = min(penalty, thiefBalance)`):

1. `shortfall = penalty - take`. If `shortfall > 0`, **force-sell the thief's
   `casino_holdings`**: sell `sharesToCover(shortfall, sellPrice, heldShares)`
   shares at the normal NAV sell price (same math as `sellStock` in
   `_actions/stock.ts`, `Math.floor` proceeds, version-guarded update on
   `casino_stock`). Proceeds are awarded with `garnish=false` + reason
   `theft_seizure`, then immediately spent with reason `theft_caught` — two
   ledger rows, wallet ends where it started, audit trail intact.
2. If the `casino_stock` version guard loses the race, **skip seizure
   entirely** and let the full shortfall become debt — the victim's claim must
   never fail because the stock fund was busy.
3. Whatever remains after seizure: `wallets.debt += remainder` (direct admin
   update; debt creation is not a coin movement, no ledger row).
4. Victim payout unchanged: full `2×` awarded immediately.

### 3. Garnish exemptions

Only explicit refunds pass `garnish=false`: the lost-race refund in `buyStock`
and any other "give the stake back because the action failed" award found
during implementation (audit all `awardBibcoins` call sites). Everything else
is garnished — including gok payouts. Consequence (accepted): a blackjack push
or roulette win returns your stake minus 50% while in debt — "sta je in het
rood, dan gok je niet."

### 4. Steal blocked while in debt

`stealCoins` (theft action) reads the thief's wallet row and bails with a
friendly Dutch error (`copy.theft.debtBlocked`) when `debt > 0`. Otherwise
stealing while in debt would be a 50%-interest loan. The steal UI
(`steal-bibcoins.tsx`) disables/explains when the viewer has debt.

### 5. UI

- `BibcoinsBalance` (header, `src/components/bibcoins/bibcoins-balance.tsx`):
  when `debt > 0`, show a red debt chip next to the coin count (e.g.
  `−1 200`), seeded server-side like the balance and kept live by extending
  `useBibcoinsRealtime` to also hand the row's `debt` to its callback (the
  realtime payload already contains the whole wallet row).
- `copy.ts`: new Dutch strings — debt label, "Je inkomsten worden voor 50%
  afgeroomd tot je schuld is afbetaald.", steal-blocked message, and an
  extended caught-message for the victim (unchanged amount) — all under a
  `copy.theft.debt*` / `copy.bibcoins` key as fits the existing structure.
- `src/types/database.ts`: `wallets.debt` column + the new `award_bibcoins`
  argument.

### 6. Pure helpers + tests

- `sharesToCover(shortfall, sellPrice, heldShares)` in `src/lib/theft/` —
  `min(heldShares, ceil(shortfall / sellPrice))`, with guards for
  `sellPrice <= 0` (sell nothing; everything becomes debt) — unit-tested
  (rounding, holdings cap, zero price, zero holdings).
- `garnishSplit(amount, debt)` mirror of the SQL rule in `src/lib/bibcoins/`
  (or alongside existing coin helpers) — unit-tested (floor rounding,
  debt smaller than half, debt 0, amount 1) and used by any TS code that wants
  to predict the outcome; SQL remains the source of truth.
- Existing EV-guard tests untouched.

## Edge cases

- Multiple caught thefts stack: `debt +=` each time.
- Thief re-buys stock later and sells: proceeds are garnished (income).
- Holdings empty at catch time: full shortfall becomes debt.
- Parking loot with a friend: the transfer back is garnished on arrival.
- Tiny awards: `floor(amount/2)` lets a 1-coin award through ungarnished —
  accepted (debt is bounded at 2× the fixed steal amount).
- The false-claim penalty (250) keeps its current best-effort clamp — out of
  scope, amounts are small.

## Rollout

Migration `0061` is run manually in the Supabase SQL editor (single
transaction, like all others). Deploy order: migration first, then the app —
the new `p_garnish` parameter has a default, and inserts tolerate the column
existing before the code ships. `pnpm exec tsc --noEmit` + `pnpm lint` +
`pnpm test` before done (local `pnpm build` may fail on `next/font`).
