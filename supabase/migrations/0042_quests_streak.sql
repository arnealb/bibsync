-- ============================================================================
-- BibSync — login streak + daily quests.
--   * daily_streak — consecutive days the daily bonus was claimed; the bonus
--     now scales 50 → 500 (least(streak,10) × 50) instead of a flat 100.
--   * daily_quest_metrics — today's (Brussels) activity counts for the quest
--     board (votes / messages / game wins / proposals / comments).
--   * claim_quest — recomputes a metric server-side and pays the reward once
--     per (day, quest). Reward/required come from the trusted server action.
-- All SECURITY DEFINER, service-role only.
-- ============================================================================

alter table public.wallets
  add column if not exists daily_streak integer not null default 0;

create or replace function public.claim_daily_bibcoins(_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  _last   date;
  _today  date := (now() at time zone 'Europe/Brussels')::date;
  _streak integer;
  _grant  integer;
begin
  insert into public.wallets (user_id) values (_user_id)
  on conflict (user_id) do nothing;

  select last_daily_on, daily_streak into _last, _streak
  from public.wallets where user_id = _user_id for update;

  if _last is not distinct from _today then
    return 0; -- already claimed today
  end if;

  if _last = _today - 1 then
    _streak := coalesce(_streak, 0) + 1; -- consecutive day
  else
    _streak := 1; -- streak reset
  end if;
  _grant := least(_streak, 10) * 50;

  update public.wallets
    set bibcoins = bibcoins + _grant,
        last_daily_on = _today,
        daily_streak = _streak
  where user_id = _user_id;

  insert into public.bibcoin_transactions (user_id, amount, reason, ref_key)
  values (_user_id, _grant, 'daily', _today::text)
  on conflict (user_id, reason, ref_key) do nothing;

  return _grant;
end;
$$;

-- Today's activity counts (Brussels day) for the quest board.
create or replace function public.daily_quest_metrics(_user_id uuid)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  with d as (select (now() at time zone 'Europe/Brussels')::date as today)
  select jsonb_build_object(
    'votes', (select count(*) from public.votes, d
       where user_id = _user_id
         and (voted_at at time zone 'Europe/Brussels')::date = d.today),
    'messages', (select count(*) from public.messages, d
       where author_id = _user_id
         and (created_at at time zone 'Europe/Brussels')::date = d.today),
    'game_wins', (select count(*) from public.bibcoin_transactions, d
       where user_id = _user_id and amount > 0 and reason like '%\_payout' escape '\'
         and (created_at at time zone 'Europe/Brussels')::date = d.today),
    'proposals', (select count(*) from public.break_proposals, d
       where created_by = _user_id
         and (created_at at time zone 'Europe/Brussels')::date = d.today),
    'comments', (select count(*) from public.proposal_comments, d
       where author_id = _user_id
         and (created_at at time zone 'Europe/Brussels')::date = d.today)
  );
$$;

-- Pay a quest reward once per day, only if its metric goal is met.
create or replace function public.claim_quest(
  _user_id  uuid,
  _key      text,
  _metric   text,
  _required integer,
  _reward   integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  _today    date := (now() at time zone 'Europe/Brussels')::date;
  _progress integer;
begin
  _progress := (public.daily_quest_metrics(_user_id) ->> _metric)::int;
  if _progress is null or _progress < _required then
    return 0;
  end if;

  insert into public.bibcoin_transactions (user_id, amount, reason, ref_key)
  values (_user_id, _reward, 'quest', _today::text || ':' || _key)
  on conflict (user_id, reason, ref_key) do nothing;
  if not found then
    return 0; -- already claimed today
  end if;

  insert into public.wallets (user_id, bibcoins) values (_user_id, 2000 + _reward)
  on conflict (user_id) do update
    set bibcoins = public.wallets.bibcoins + _reward;
  return _reward;
end;
$$;

revoke execute on function public.daily_quest_metrics(uuid) from public, authenticated;
revoke execute on function public.claim_quest(uuid, text, text, integer, integer)
  from public, authenticated;
grant execute on function public.daily_quest_metrics(uuid) to service_role;
grant execute on function public.claim_quest(uuid, text, text, integer, integer)
  to service_role;
