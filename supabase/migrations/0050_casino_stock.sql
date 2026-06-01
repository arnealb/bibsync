-- ============================================================================
-- BibSync — casino stock ("BIB-aandeel"). A global NAV fund backed by the
-- casino's realized house profit. Players buy/sell shares; the price = the
-- fund treasury / shares outstanding. The treasury holds invested coins plus
-- the house profit earned while shares are held, so the price rises when
-- players lose (house wins) and falls when players win big.
--
-- All balance math runs server-side in the stock action via the existing
-- award_/spend_bibcoins RPCs; this migration only stores fund state, exposes a
-- read-only casino_stats() helper, and snapshots an hourly price tick.
-- ============================================================================

-- Speeds up the casino-net aggregate below.
create index if not exists bibcoin_transactions_reason_idx
  on public.bibcoin_transactions (reason);

-- Singleton fund state (id is always true).
create table if not exists public.casino_stock (
  id           boolean primary key default true,
  shares       integer not null default 0,
  treasury     double precision not null default 0,
  baseline_net bigint not null default 0,
  version      integer not null default 0,
  updated_at   timestamptz not null default now(),
  constraint casino_stock_singleton check (id)
);
insert into public.casino_stock (id) values (true) on conflict do nothing;

-- Per-user holdings.
create table if not exists public.casino_holdings (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  shares     integer not null default 0,
  cost_basis bigint not null default 0,
  updated_at timestamptz not null default now()
);

-- Price history for the chart (appended on each trade + hourly via cron).
create table if not exists public.casino_stock_history (
  id          bigint generated always as identity primary key,
  price       double precision not null,
  shares      integer not null,
  net         bigint not null,
  recorded_at timestamptz not null default now()
);
create index if not exists casino_stock_history_time_idx
  on public.casino_stock_history (recorded_at);

-- RLS: everyone may read fund state + history; only the service role writes.
alter table public.casino_stock enable row level security;
alter table public.casino_holdings enable row level security;
alter table public.casino_stock_history enable row level security;

drop policy if exists casino_stock_select on public.casino_stock;
create policy casino_stock_select on public.casino_stock
  for select to authenticated using (true);

drop policy if exists casino_stock_history_select on public.casino_stock_history;
create policy casino_stock_history_select on public.casino_stock_history
  for select to authenticated using (true);

-- You can read only your own holdings.
drop policy if exists casino_holdings_select_own on public.casino_holdings;
create policy casino_holdings_select_own on public.casino_holdings
  for select to authenticated using (user_id = auth.uid());

-- Realtime: live price + own holdings.
alter publication supabase_realtime add table public.casino_stock;
alter publication supabase_realtime add table public.casino_holdings;

-- ----------------------------------------------------------------------------
-- casino_stats() — house profit ("net") and total wagered, from the ledger.
-- Stakes log a negative amount, payouts a positive one, so house profit is the
-- negated sum. MIRROR of CASINO_*_REASONS in src/lib/stock/config.ts.
-- ----------------------------------------------------------------------------
create or replace function public.casino_stats()
returns table(net bigint, wagered bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    -coalesce(sum(amount), 0)::bigint as net,
    -coalesce(sum(amount) filter (where amount < 0), 0)::bigint as wagered
  from public.bibcoin_transactions
  where reason in (
    'dice_bet','wheel_bet','hilo_bet','keno_bet','plinko_bet','mines_bet',
    'blackjack_bet','roulette_bet','crash_bet',
    'dice_payout','wheel_payout','hilo_payout','keno_payout','plinko_payout',
    'mines_payout','blackjack_payout','blackjack_win','roulette_payout',
    'roulette_win','crash_payout',
    'hilo_refund','mines_refund','blackjack_refund','roulette_refund',
    'crash_refund'
  );
$$;

revoke execute on function public.casino_stats() from public, authenticated;
grant execute on function public.casino_stats() to service_role;

-- ----------------------------------------------------------------------------
-- snapshot_casino_stock() — fold accrued house profit into the treasury and
-- record a price tick. Scheduled hourly so the chart drifts with gambling even
-- when nobody trades. INITIAL_PRICE (100) / MIN_PRICE (1) mirror the TS config.
-- ----------------------------------------------------------------------------
create or replace function public.snapshot_casino_stock()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _net   bigint;
  _stock record;
  _tre   double precision;
  _price double precision;
begin
  select net into _net from public.casino_stats();
  select * into _stock from public.casino_stock where id;

  if _stock.shares > 0 then
    _tre := _stock.treasury + (_net - _stock.baseline_net);
    update public.casino_stock
      set treasury = _tre, baseline_net = _net, updated_at = now()
      where id;
    _price := greatest(1, _tre / _stock.shares);
  else
    _price := 100;
  end if;

  insert into public.casino_stock_history (price, shares, net)
  values (_price, _stock.shares, _net);
end;
$$;

revoke execute on function public.snapshot_casino_stock() from public, authenticated;
grant execute on function public.snapshot_casino_stock() to service_role;

create extension if not exists pg_cron;

do $$ begin perform cron.unschedule('casino-stock-tick'); exception when others then null; end $$;
select cron.schedule('casino-stock-tick', '7 * * * *',
  $$select public.snapshot_casino_stock()$$);
