-- 0032_coin_earning.sql
-- More ways to earn bibcoins so a player who gambled their balance away isn't
-- stuck: a once-a-day login bonus, and a bigger hourly passive trickle.
-- Run in the Supabase SQL editor, after 0031.

-- Track the last Brussels day the login bonus was claimed (null = never).
alter table public.wallets
  add column if not exists last_daily_on date;

-- Once-a-day login bonus. Idempotent per Brussels day: a second call the same
-- day returns 0. Mirrors claim_hourly_bibcoins (service-role only).
create or replace function public.claim_daily_bibcoins(_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  _last  date;
  _today date := (now() at time zone 'Europe/Brussels')::date;
  _grant integer := 100;
begin
  insert into public.wallets (user_id) values (_user_id)
  on conflict (user_id) do nothing;

  select last_daily_on into _last from public.wallets
  where user_id = _user_id for update;

  if _last is not distinct from _today then
    return 0;
  end if;

  update public.wallets
    set bibcoins = bibcoins + _grant,
        last_daily_on = _today
  where user_id = _user_id;

  insert into public.bibcoin_transactions (user_id, amount, reason, ref_key)
  values (_user_id, _grant, 'daily', _today::text)
  on conflict (user_id, reason, ref_key) do nothing;

  return _grant;
end;
$$;

revoke execute on function public.claim_daily_bibcoins(uuid) from public, authenticated;
grant  execute on function public.claim_daily_bibcoins(uuid) to service_role;

-- Bump the passive trickle from +5/hour to +15/hour (cap still 48 hours).
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

  _grant := _hours * 15;
  update public.wallets
    set bibcoins = bibcoins + _grant,
        last_hourly_at = _last + (_hours || ' hours')::interval
  where user_id = _user_id;
  insert into public.bibcoin_transactions (user_id, amount, reason, ref_key)
  values (_user_id, _grant, 'hourly', extract(epoch from now())::text);
  return _grant;
end;
$$;
