-- ============================================================================
-- BibSync — Paardenraces. One GLOBAL race every clock hour: six coloured
-- horses get random stats (speed/stamina/sprint); their win chances derive
-- from those stats, so every race has favourites and longshots. Players bet
-- bibcoins on a horse during the hour; at the next :00 a pg_cron job draws
-- the winner (weighted by the stored chances) and pays fixed odds:
-- multiplier = (1 − 5% house edge) / win chance, payouts floored. Win
-- chances are floored at 2% (taken from the favourite) so longshot odds keep
-- the same uniform edge instead of quietly ripping outsiders off.
--
-- Like the lottery draw and stock snapshot, resolution runs in SQL so it
-- fires regardless of who's online. All writes go through service-only
-- SECURITY DEFINER functions; clients can only read. The odds formula and
-- replay animation are MIRRORED in src/lib/horses/ (EV guard tests) — the
-- SQL here is authoritative. Run manually in the Supabase SQL editor, after
-- 0065.
-- ============================================================================

create table if not exists public.horse_races (
  id         bigint generated always as identity primary key,
  runs_at    timestamptz not null unique,
  status     text not null default 'open' check (status in ('open', 'resolved')),
  -- [{color, speed, stamina, sprint, winBp, multBp}] — odds fixed at creation
  horses     jsonb not null,
  name_seed  integer not null,
  run_seed   integer,
  winner_idx integer,
  created_at timestamptz not null default now()
);

create table if not exists public.horse_race_bets (
  id         uuid primary key default gen_random_uuid(),
  race_id    bigint not null references public.horse_races(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  horse_idx  integer not null check (horse_idx between 0 and 5),
  amount     integer not null check (amount > 0),
  payout     integer, -- set at settlement; 0 = lost
  created_at timestamptz not null default now()
);

create index if not exists horse_race_bets_race_idx
  on public.horse_race_bets (race_id, created_at desc);
create index if not exists horse_race_bets_user_idx
  on public.horse_race_bets (user_id, created_at desc);

alter table public.horse_races enable row level security;
alter table public.horse_race_bets enable row level security;

-- The race card and the betting feed are public (social betting, no hidden
-- info: the winner is only drawn at the :00, after betting closed).
drop policy if exists horse_races_select on public.horse_races;
create policy horse_races_select on public.horse_races
  for select to authenticated using (true);

drop policy if exists horse_race_bets_select on public.horse_race_bets;
create policy horse_race_bets_select on public.horse_race_bets
  for select to authenticated using (true);

alter publication supabase_realtime add table public.horse_races;
alter publication supabase_realtime add table public.horse_race_bets;

-- ----------------------------------------------------------------------------
-- open_horse_race(runs_at) — generate six horses and open the betting window.
-- strength = 0.45·speed + 0.35·stamina + 0.20·sprint (stats 40–99); the win
-- chance is strength⁴ normalised to 10000 bp. MIRROR of src/lib/horses/engine.
-- ----------------------------------------------------------------------------
create or replace function public.open_horse_race(_runs_at timestamptz)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _colors   text[] := array['red','blue','green','yellow','purple','orange'];
  _speed    int[];
  _stamina  int[];
  _sprint   int[];
  _weight   numeric[];
  _sum      numeric := 0;
  _win      int[];
  _acc      int := 0;
  _short    int := 0;
  _maxi     int := 1;
  _horses   jsonb := '[]'::jsonb;
  _strength numeric;
begin
  for i in 1..6 loop
    _speed[i]   := 40 + floor(random() * 60)::int;
    _stamina[i] := 40 + floor(random() * 60)::int;
    _sprint[i]  := 40 + floor(random() * 60)::int;
    _strength   := 0.45 * _speed[i] + 0.35 * _stamina[i] + 0.20 * _sprint[i];
    _weight[i]  := power(_strength, 4);
    _sum        := _sum + _weight[i];
  end loop;

  -- Win chances in basis points; the last horse absorbs rounding.
  for i in 1..5 loop
    _win[i] := floor(10000 * _weight[i] / _sum)::int;
    _acc    := _acc + _win[i];
  end loop;
  _win[6] := 10000 - _acc;

  -- Floor longshots at 200 bp (2%), paid for by the favourite, so the odds
  -- keep the uniform 5% edge for every horse.
  for i in 1..6 loop
    if _win[i] > _win[_maxi] then _maxi := i; end if;
  end loop;
  for i in 1..6 loop
    if _win[i] < 200 then
      _short  := _short + (200 - _win[i]);
      _win[i] := 200;
    end if;
  end loop;
  _win[_maxi] := _win[_maxi] - _short;

  for i in 1..6 loop
    _horses := _horses || jsonb_build_object(
      'color',   _colors[i],
      'speed',   _speed[i],
      'stamina', _stamina[i],
      'sprint',  _sprint[i],
      'winBp',   _win[i],
      -- (10000 − 500 edge) / chance, ×50 sanity cap (never binds after the floor)
      'multBp',  least(floor(9500.0 * 10000 / _win[i])::int, 500000)
    );
  end loop;

  insert into public.horse_races (runs_at, horses, name_seed)
  values (_runs_at, _horses, floor(random() * 1000000000)::int)
  on conflict (runs_at) do nothing;
end;
$$;

-- ----------------------------------------------------------------------------
-- place_horse_bet() — stake a bet on an open race. Locks the race row, so a
-- bet and the resolver serialise: after resolution starts no bet can slip in
-- unpaid, and a bet that grabs the lock first is included in the payout loop.
-- ----------------------------------------------------------------------------
create or replace function public.place_horse_bet(
  _user_id uuid,
  _race_id bigint,
  _horse_idx integer,
  _amount integer
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  _race record;
begin
  if _horse_idx not between 0 and 5 or _amount < 10 or _amount > 5000 then
    return 'invalid';
  end if;

  select * into _race from public.horse_races
  where id = _race_id
  for update;

  if not found or _race.status <> 'open' or _race.runs_at <= now() then
    return 'closed';
  end if;

  if not public.spend_bibcoins(
    _user_id, _amount, 'horses_bet',
    _race_id::text || ':' || _horse_idx::text
  ) then
    return 'broke';
  end if;

  insert into public.horse_race_bets (race_id, user_id, horse_idx, amount)
  values (_race_id, _user_id, _horse_idx, _amount);
  return 'ok';
end;
$$;

-- ----------------------------------------------------------------------------
-- run_horse_races() — hourly: draw the winner of every due race (weighted by
-- the stored winBp), pay the winners (floored, idempotent per bet id), and
-- open the next race at the coming :00. Self-healing: overdue races resolve
-- on the next run, and the next race is (re)opened unconditionally.
-- ----------------------------------------------------------------------------
create or replace function public.run_horse_races()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _race   record;
  _bet    record;
  _pick   int;
  _acc    int;
  _winner int;
  _mult   int;
  _payout int;
begin
  for _race in
    select * from public.horse_races
    where status = 'open' and runs_at <= now()
    order by runs_at
    for update
  loop
    _pick := floor(random() * 10000)::int;
    _acc := 0;
    _winner := 5;
    for i in 0..5 loop
      _acc := _acc + ((_race.horses->i)->>'winBp')::int;
      if _pick < _acc then
        _winner := i;
        exit;
      end if;
    end loop;

    update public.horse_races
      set status = 'resolved',
          winner_idx = _winner,
          run_seed = floor(random() * 2147483647)::int
    where id = _race.id;

    _mult := ((_race.horses->_winner)->>'multBp')::int;

    update public.horse_race_bets
      set payout = 0
    where race_id = _race.id and horse_idx <> _winner;

    for _bet in
      select * from public.horse_race_bets
      where race_id = _race.id and horse_idx = _winner
    loop
      _payout := floor(_bet.amount::numeric * _mult / 10000)::int;
      perform public.award_bibcoins(
        _bet.user_id, _payout, 'horses_payout', _bet.id::text
      );
      update public.horse_race_bets set payout = _payout where id = _bet.id;
    end loop;
  end loop;

  perform public.open_horse_race(date_trunc('hour', now()) + interval '1 hour');
end;
$$;

revoke execute on function public.open_horse_race(timestamptz) from public, authenticated;
revoke execute on function public.place_horse_bet(uuid, bigint, integer, integer) from public, authenticated;
revoke execute on function public.run_horse_races() from public, authenticated;
grant execute on function public.open_horse_race(timestamptz) to service_role;
grant execute on function public.place_horse_bet(uuid, bigint, integer, integer) to service_role;
grant execute on function public.run_horse_races() to service_role;

-- ----------------------------------------------------------------------------
-- The racebook is house-banked gambling, so it moves the BIB-aandeel:
-- redefine casino_stats() with the horses reasons added. Supersedes 0052.
-- MIRROR of CASINO_*_REASONS in src/lib/stock/config.ts + 'theft_false_claim'.
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
    -coalesce(sum(amount) filter (where reason in (
      'dice_bet','wheel_bet','hilo_bet','keno_bet','plinko_bet','mines_bet',
      'blackjack_bet','roulette_bet','crash_bet','horses_bet'
    )), 0)::bigint as wagered
  from public.bibcoin_transactions
  where reason in (
    'dice_bet','wheel_bet','hilo_bet','keno_bet','plinko_bet','mines_bet',
    'blackjack_bet','roulette_bet','crash_bet','horses_bet',
    'dice_payout','wheel_payout','hilo_payout','keno_payout','plinko_payout',
    'mines_payout','blackjack_payout','blackjack_win','roulette_payout',
    'roulette_win','crash_payout','horses_payout',
    'hilo_refund','mines_refund','blackjack_refund','roulette_refund',
    'crash_refund',
    'theft_false_claim'
  );
$$;

revoke execute on function public.casino_stats() from public, authenticated;
grant execute on function public.casino_stats() to service_role;

-- Hourly resolution + next-race opening, exactly on the :00.
do $$
begin
  perform cron.unschedule('horse-races');
exception when others then null;
end $$;

select cron.schedule('horse-races', '0 * * * *',
  $$select public.run_horse_races()$$);

-- Open the first race right away (betting until the coming :00).
select public.open_horse_race(date_trunc('hour', now()) + interval '1 hour');
