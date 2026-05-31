-- ============================================================================
-- BibSync — daily "Snake master" reward. Each day just after Brussels midnight,
-- the player holding the highest HONEST snake score in a room gets 75 bibcoins.
-- Idempotent per (room, Brussels date) via the award_bibcoins ledger, so it can
-- run more than once without paying twice. Two UTC cron times (22:01 / 23:01)
-- cover both DST offsets so the award lands right after Brussels midnight.
-- Requires pg_cron (already used for the chat-photo cleanup).
-- ============================================================================

create extension if not exists pg_cron;

create or replace function public.award_snake_masters()
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
      75,
      'snake_master',
      _rec.room_id::text || ':' || _today::text
    );
  end loop;
end;
$$;

revoke execute on function public.award_snake_masters() from public, authenticated;
grant execute on function public.award_snake_masters() to service_role;

-- (Re)schedule the daily job(s). Both UTC times resolve to ~00:01 Brussels
-- across DST; the per-day idempotency makes the second run a no-op.
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

select cron.schedule('snake-master-winter', '1 23 * * *',
  $$select public.award_snake_masters()$$);
select cron.schedule('snake-master-summer', '1 22 * * *',
  $$select public.award_snake_masters()$$);
