-- ============================================================================
-- BibSync — Minesweeper ranks on completion time, per difficulty.
--
-- The single "minesweeper" game key (score = revealed safe cells) is split
-- into "minesweeper_easy" / "minesweeper_medium" / "minesweeper_hard". The
-- app now only records WON games under those keys: score = the difficulty's
-- (constant) safe-cell count and duration_seconds = the elapsed time, so the
-- existing score-desc/time-asc ranking reduces to "fastest win first" within
-- a difficulty. Lost games still pay arcade coins but insert no score row.
--
-- award_game_kings() (last changed in 0063_minesweeper_king.sql) is replaced
-- with the same logic over the new key list: the old "minesweeper" key drops
-- out (its revealed-cell scores are not comparable to times and stop earning
-- a King) and each difficulty crowns its own daily King of 500 bibcoins —
-- the room's fastest honest win. The cron jobs from 0051 keep calling the
-- function by name — no re-scheduling needed. Old "minesweeper" rows are
-- kept (history) but read by nothing. Run manually in the Supabase SQL
-- editor, after 0063.
--
-- NOTE: the 500 below must stay in sync with GAME_KING_REWARD in
-- src/lib/games/constants.ts.
-- ============================================================================

create or replace function public.award_game_kings()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _today date := (now() at time zone 'Europe/Brussels')::date;
  _game  text;
  _games text[] := array['flappy','tetris','2048','petconnect','usstates',
    'minesweeper_easy','minesweeper_medium','minesweeper_hard'];
  _rec   record;
begin
  foreach _game in array _games loop
    for _rec in
      select distinct on (room_id) room_id, user_id
      from public.game_scores
      where game_key = _game and not cheated
      -- ties: fastest time first (untimed last), then earliest record holder
      order by room_id, score desc, duration_seconds asc nulls last,
        created_at asc
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

-- create or replace keeps the ACLs from 0051, but re-state them defensively.
revoke execute on function public.award_game_kings() from public, authenticated;
grant execute on function public.award_game_kings() to service_role;
