-- ============================================================================
-- BibSync — bibcoins economy + cosmetics
--
-- Global per-user currency (wallets), an idempotent ledger, and cosmetics
-- (owned items + an equipped loadout). All balance changes go through
-- SECURITY DEFINER functions that are revoked from normal users, so balances
-- can only be changed server-side (service role) — clients can read, never write.
-- ============================================================================

create table if not exists public.wallets (
  user_id        uuid primary key references public.profiles(id) on delete cascade,
  bibcoins       integer not null default 2000,
  last_hourly_at timestamptz not null default now()
);

create table if not exists public.bibcoin_transactions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  amount     integer not null,
  reason     text not null,
  ref_key    text not null default '',
  created_at timestamptz not null default now(),
  unique (user_id, reason, ref_key)
);

create index if not exists bibcoin_transactions_user_idx
  on public.bibcoin_transactions (user_id, created_at desc);

create table if not exists public.user_cosmetics (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  item_id     text not null,
  acquired_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

create table if not exists public.user_loadout (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  frame      text,
  name_color text,
  badge      text,
  accessory  text,
  pet        text,
  updated_at timestamptz not null default now()
);

create table if not exists public.user_achievements (
  user_id        uuid not null references public.profiles(id) on delete cascade,
  achievement_id text not null,
  unlocked_at    timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

alter table public.wallets enable row level security;
alter table public.bibcoin_transactions enable row level security;
alter table public.user_cosmetics enable row level security;
alter table public.user_loadout enable row level security;
alter table public.user_achievements enable row level security;

-- Read-only for the owner (balances/ledger/owned/achievements stay private)...
drop policy if exists "wallets_select_own" on public.wallets;
create policy "wallets_select_own" on public.wallets
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "tx_select_own" on public.bibcoin_transactions;
create policy "tx_select_own" on public.bibcoin_transactions
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "cosmetics_select_own" on public.user_cosmetics;
create policy "cosmetics_select_own" on public.user_cosmetics
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "achievements_select_own" on public.user_achievements;
create policy "achievements_select_own" on public.user_achievements
  for select to authenticated using (user_id = auth.uid());

-- ...but the equipped loadout is public-facing (rendered on everyone's avatar).
drop policy if exists "loadout_select_all" on public.user_loadout;
create policy "loadout_select_all" on public.user_loadout
  for select to authenticated using (true);

-- No client insert/update policies anywhere: all writes go via the functions
-- below (service role) or the service-role client in server actions.

-- --- balance functions (service-only) -------------------------------------

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

  insert into public.wallets (user_id, bibcoins)
  values (_user_id, 2000 + _amount)
  on conflict (user_id) do update
    set bibcoins = public.wallets.bibcoins + _amount;
  return true;
end;
$$;

create or replace function public.spend_bibcoins(
  _user_id uuid,
  _amount integer,
  _reason text,
  _ref text default ''
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  _balance integer;
begin
  insert into public.wallets (user_id) values (_user_id)
  on conflict (user_id) do nothing;

  select bibcoins into _balance from public.wallets
  where user_id = _user_id for update;

  if _balance < _amount then
    return false;
  end if;

  update public.wallets set bibcoins = bibcoins - _amount where user_id = _user_id;
  insert into public.bibcoin_transactions (user_id, amount, reason, ref_key)
  values (
    _user_id, -_amount, _reason,
    coalesce(_ref, '') || ':' || extract(epoch from now())::text
  );
  return true;
end;
$$;

create or replace function public.claim_hourly_bibcoins(_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  _last  timestamptz;
  _hours integer;
  _grant integer;
begin
  insert into public.wallets (user_id) values (_user_id)
  on conflict (user_id) do nothing;

  select last_hourly_at into _last from public.wallets
  where user_id = _user_id for update;

  _hours := least(floor(extract(epoch from (now() - _last)) / 3600)::int, 48);
  if _hours <= 0 then
    return 0;
  end if;

  _grant := _hours * 5;
  update public.wallets
    set bibcoins = bibcoins + _grant,
        last_hourly_at = _last + (_hours || ' hours')::interval
  where user_id = _user_id;
  insert into public.bibcoin_transactions (user_id, amount, reason, ref_key)
  values (_user_id, _grant, 'hourly', extract(epoch from now())::text);
  return _grant;
end;
$$;

revoke execute on function public.award_bibcoins(uuid, integer, text, text) from public, authenticated;
revoke execute on function public.spend_bibcoins(uuid, integer, text, text) from public, authenticated;
revoke execute on function public.claim_hourly_bibcoins(uuid) from public, authenticated;
grant execute on function public.award_bibcoins(uuid, integer, text, text) to service_role;
grant execute on function public.spend_bibcoins(uuid, integer, text, text) to service_role;
grant execute on function public.claim_hourly_bibcoins(uuid) to service_role;

-- Live updates: your own balance, and everyone's equipped cosmetics.
alter publication supabase_realtime add table public.wallets;
alter publication supabase_realtime add table public.user_loadout;
