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
