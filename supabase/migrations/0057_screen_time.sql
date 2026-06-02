-- ============================================================================
-- BibSync — "Schermtijd": track how long each user actually has the app open
-- (visible) and reward it. The browser sends a heartbeat every ~60s while the
-- tab is visible; the server credits only the real wall-clock gap since the
-- last beat (capped, so spamming heartbeats can't inflate it and a closed tab
-- accrues nothing). Daily reward: 10 bibcoins per full minute of screen time,
-- capped at 720 min/day (anti-abuse). SECURITY DEFINER, service-role only.
-- ============================================================================

-- Per-user, per-day screen time in seconds + how many coins we've already paid
-- for it (the row itself is the idempotency guard for the incremental reward).
create table if not exists public.screen_time (
  user_id       uuid not null references auth.users (id) on delete cascade,
  day           date not null,
  seconds       int  not null default 0,
  awarded_coins int  not null default 0,
  primary key (user_id, day)
);

alter table public.screen_time enable row level security;

-- Users may read their own screen time (for the profile display). Writes only
-- happen through the SECURITY DEFINER RPC below, never directly.
drop policy if exists screen_time_self on public.screen_time;
create policy screen_time_self on public.screen_time
  for select using (user_id = auth.uid());

-- Last heartbeat per user — lets the RPC compute the real elapsed gap. No RLS
-- policies: it is read/written exclusively by the SECURITY DEFINER function.
create table if not exists public.screen_time_state (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  last_ping_at timestamptz
);

alter table public.screen_time_state enable row level security;

-- Records a screen-time heartbeat for the user and pays out any newly earned
-- daily reward. Returns today's total seconds and the coins just credited.
-- `_resume` = true only resets the baseline (adds nothing) — the client sends
-- it when the tab becomes visible again, so time spent on a hidden/backgrounded
-- tab is never counted; periodic beats while visible pass false.
create or replace function public.record_screen_time(
  _user_id uuid,
  _resume  boolean default false
)
returns table (total_seconds int, coins_earned int)
language plpgsql
security definer
set search_path = public
as $$
declare
  _now     timestamptz := now();
  _today   date := (_now at time zone 'Europe/Brussels')::date;
  _last    timestamptz;
  _delta   int;
  _max_gap int := 90;   -- cap per heartbeat (s): a missed/slow beat can't over-count
  _cap_min int := 720;  -- max rewarded minutes per day (12h) — anti-abuse
  _seconds int;
  _awarded int;
  _owed    int;
  _credit  int := 0;
begin
  select last_ping_at into _last
  from public.screen_time_state where user_id = _user_id;

  -- A first/resumed beat has no countable interval — it just sets the baseline.
  if _last is null or _resume then
    _delta := 0;
  else
    _delta := least(greatest(extract(epoch from (_now - _last))::int, 0), _max_gap);
  end if;

  insert into public.screen_time_state (user_id, last_ping_at)
  values (_user_id, _now)
  on conflict (user_id) do update set last_ping_at = _now;

  insert into public.screen_time (user_id, day, seconds)
  values (_user_id, _today, _delta)
  on conflict (user_id, day) do update
    set seconds = public.screen_time.seconds + _delta
  returning seconds, awarded_coins into _seconds, _awarded;

  -- Reward: 10 coins per full minute, capped at _cap_min minutes/day. Only the
  -- delta over what we've already paid today is credited (idempotent).
  _owed := least(_seconds / 60, _cap_min) * 10;
  if _owed > _awarded then
    _credit := _owed - _awarded;

    update public.screen_time set awarded_coins = _owed
    where user_id = _user_id and day = _today;

    insert into public.bibcoin_transactions (user_id, amount, reason, ref_key)
    values (_user_id, _credit, 'screen_time', _today::text || ':' || _owed::text)
    on conflict (user_id, reason, ref_key) do nothing;

    insert into public.wallets (user_id, bibcoins) values (_user_id, 2000 + _credit)
    on conflict (user_id) do update
      set bibcoins = public.wallets.bibcoins + _credit;
  end if;

  return query select _seconds, _credit;
end;
$$;

revoke execute on function public.record_screen_time(uuid, boolean) from public, authenticated;
grant execute on function public.record_screen_time(uuid, boolean) to service_role;
