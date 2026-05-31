-- ============================================================================
-- BibSync — daily "Snake King" reward (replaces "Snake master", migration 0044).
-- Each day just after Brussels midnight, the player holding the highest HONEST
-- snake score in a room gets 1000 bibcoins. Idempotent per (room, Brussels date)
-- via the award_bibcoins ledger, so it can run more than once without paying
-- twice. Two UTC cron times (22:01 / 23:01) cover both DST offsets so the award
-- lands right after Brussels midnight. Requires pg_cron.
--
-- The King *title/badge* in the app is computed live from the leaderboard
-- (honest #1), not by this job — this job only pays out.
--
-- NOTE: the 1000 below must stay in sync with SNAKE_KING_REWARD in
-- src/lib/games/constants.ts.
-- ============================================================================

create extension if not exists pg_cron;

-- Retire the old "Snake master" job + function.
do $$
begin
  perform cron.unschedule('snake-master-winter');
exception when others then null;
end $$;
do $$
begin
  perform cron.unschedule('snake-master-summer');
exception when others then null;
end $$;

drop function if exists public.award_snake_masters();

create or replace function public.award_snake_kings()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _today date := (now() at time zone 'Europe/Brussels')::date;
  _rec   record;
begin
  for _rec in
    select distinct on (room_id) room_id, user_id
    from public.game_scores
    where game_key = 'snake' and not cheated
    order by room_id, score desc, created_at asc -- ties: earliest record holder
  loop
    perform public.award_bibcoins(
      _rec.user_id,
      1000,
      'snake_king',
      _rec.room_id::text || ':' || _today::text
    );
  end loop;
end;
$$;

revoke execute on function public.award_snake_kings() from public, authenticated;
grant execute on function public.award_snake_kings() to service_role;

-- (Re)schedule the daily job(s). Both UTC times resolve to ~00:01 Brussels
-- across DST; the per-day idempotency makes the second run a no-op.
do $$
begin
  perform cron.unschedule('snake-king-winter');
exception when others then null;
end $$;
do $$
begin
  perform cron.unschedule('snake-king-summer');
exception when others then null;
end $$;

select cron.schedule('snake-king-winter', '1 23 * * *',
  $$select public.award_snake_kings()$$);
select cron.schedule('snake-king-summer', '1 22 * * *',
  $$select public.award_snake_kings()$$);
