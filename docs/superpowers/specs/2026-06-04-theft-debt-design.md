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
- **Garnish as a `BEFORE UPDATE OF bibcoins` trigger on `wallets`**
  (`garnish_wallet_credit()`), NOT inside `award_bibcoins` — six functions
  credit wallets directly without going through the award RPC
  (`claim_hourly_bibcoins`, `claim_daily_bibcoins` + quests in `0032`/`0042`,
  `transfer_bibcoins` in `0037`, the strijder bonus in `0047`,
  `record_screen_time` in `0057`). The trigger is the only choke point that
  covers all of them plus anything future:
  - When `bibcoins` increase on a row with `debt > 0` and the transaction has
    not flagged itself exempt: `garnish := least(debt, floor(gain / 2.0))` —
    the credit is reduced by `garnish`, `debt` decreases by `garnish`. The
    garnished coins are **burned** (no counter-credit anywhere) to offset the
    minted victim payout.
  - The garnish is recorded as its own ledger row, reason
    **`theft_debt_repayment`** — the `theft_` prefix keeps it out of the
    "did the victim spend since the steal" check in `claimRobbed`, so a
    debtor's forced repayments never expire their own claim window.
  - A brand-new wallet starts at `debt = 0`, and a retried award ref
    short-circuits before touching the wallet, so nothing double-garnishes.
- `award_bibcoins` keeps its signature; refund-style awards set a
  transaction-local flag (`set_config('bibsync.skip_garnish', '1', true)`,
  reset after the wallet update) that the trigger honours.
- New `add_wallet_debt(_user_id, _amount)` SECURITY DEFINER RPC (atomic
  `debt = debt + _amount`), revoked from `authenticated`, granted to
  `service_role` — used by `claimRobbed` for the uncovered remainder.

### 2. Seizure + debt in `claimRobbed` (`src/app/_actions/theft.ts`)

After the existing wallet drain (`take = min(penalty, thiefBalance)`):

1. `shortfall = penalty - take`. If `shortfall > 0`, **force-sell the thief's
   `casino_holdings`**: sell `sharesToCover(shortfall, sellPrice, heldShares)`
   shares at the normal NAV sell price (same math as `sellStock` in
   `_actions/stock.ts`, `Math.floor` proceeds, version-guarded update on
   `casino_stock`). Proceeds are awarded with reason `theft_seizure`
   (garnish-exempt by reason), then the covered slice is immediately spent
   with reason `theft_caught` — two ledger rows, audit trail intact; change
   from an over-sold share stays with the thief.
2. If the `casino_stock` version guard loses the race, **skip seizure
   entirely** and let the full shortfall become debt — the victim's claim must
   never fail because the stock fund was busy.
3. Whatever remains after seizure: `wallets.debt += remainder` (direct admin
   update; debt creation is not a coin movement, no ledger row).
4. Victim payout unchanged: full `2×` awarded immediately.

### 3. Garnish exemptions

Exemption is **by award reason inside `award_bibcoins`** (no TS call-site
edits): reasons matching `%refund%` plus `crate_dup` and `theft_seizure` set
the skip flag. That covers every existing refund path (`stock_refund`,
`blackjack_refund`, `hilo_refund`, `mines_refund`, `crash_refund`,
`lottery_refund`, `poker_refund`, `pillory_refund`, `pillory_set_refund`,
`merge_energy_refund`, `name-change-refund`, `theft_loss_refund`,
`theft_gain_refund`, `crate_refund`). Mirrored as `isGarnishExempt()` in
`src/lib/theft/debt.ts` (SQL is authoritative). Everything else is garnished —
including gok payouts. Consequence (accepted): a blackjack push or roulette
win returns your stake minus 50% while in debt — "sta je in het rood, dan gok
je niet."

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
- `copy.ts`: new Dutch strings under `copy.theft` — `debtBlocked` (steal
  blocked while in debt) and `debtHint` (chip tooltip explaining the 50%
  garnish). The victim's claim messages are unchanged.
- `src/types/database.ts`: `wallets.debt` column + the new `award_bibcoins`
  argument.

### 6. Pure helpers + tests

- `sharesToCover(shortfall, sellPrice, heldShares)` in `src/lib/theft/` —
  `min(heldShares, ceil(shortfall / sellPrice))`, with guards for
  `sellPrice <= 0` (sell nothing; everything becomes debt) — unit-tested
  (rounding, holdings cap, zero price, zero holdings).
- `garnishSplit(amount, debt)` + `isGarnishExempt(reason)` mirrors of the SQL
  rules in `src/lib/theft/debt.ts` — unit-tested (floor rounding, debt smaller
  than half, debt 0, amount 1; exempt reason list); SQL remains the source of
  truth.
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
