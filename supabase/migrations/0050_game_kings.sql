-- ============================================================================
-- BibSync — daily "King" for the non-Snake skill games (Flappy, Tetris, 2048,
-- Pet Connect). Mirrors 0047_snake_king.sql but pays 500 and covers four games.
-- Just after Brussels midnight, the top HONEST scorer per room per game wins
-- 500 bibcoins. Idempotent per (game, room, Brussels date) via the
-- award_bibcoins ledger. Two UTC cron times cover both DST offsets. Requires
-- pg_cron. Run manually in the Supabase SQL editor, after 0047.
--
-- NOTE: the 500 below must stay in sync with GAME_KING_REWARD in
-- src/lib/games/constants.ts.
-- ============================================================================

create extension if not exists pg_cron;

create or replace function public.award_game_kings()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _today date := (now() at time zone 'Europe/Brussels')::date;
  _game  text;
  _games text[] := array['flappy','tetris','2048','petconnect'];
  _rec   record;
begin
  foreach _game in array _games loop
    for _rec in
      select distinct on (room_id) room_id, user_id
      from public.game_scores
      where game_key = _game and not cheated
      order by room_id, score desc, created_at asc -- ties: earliest record holder
    loop
      perform public.award_bibcoins(
        _rec.user_id,
        500,
        _game || '_king',
        _rec.room_id::text || ':' || _today::text
      );
    end loop;
  end loop;
end;
$$;

revoke execute on function public.award_game_kings() from public, authenticated;
grant execute on function public.award_game_kings() to service_role;

do $$
begin
  perform cron.unschedule('game-kings-winter');
exception when others then null;
end $$;
do $$
begin
  perform cron.unschedule('game-kings-summer');
exception when others then null;
end $$;

select cron.schedule('game-kings-winter', '1 23 * * *',
  $$select public.award_game_kings()$$);
select cron.schedule('game-kings-summer', '1 22 * * *',
  $$select public.award_game_kings()$$);
