-- ============================================================================
-- BibSync — add USA Staten (usstates) to the daily game-King payout, with a
-- time tie-break.
--
-- 1. game_scores.duration_seconds (nullable): seconds from the start of a run
--    to its LAST correct answer. Only USA Staten fills it (client-reported,
--    same trust model as the score itself); other games leave it null. Rows
--    from before this migration stay null and lose ties to timed runs.
-- 2. award_game_kings() (from 0051_game_kings.sql) is replaced with the same
--    logic, now covering five games and breaking score ties by fastest time
--    first (nulls last), then earliest record holder. The top HONEST usstates
--    scorer per room earns 500 bibcoins/day, idempotent per (game, room,
--    Brussels date) via the award_bibcoins ledger. The cron schedules from
--    0051 keep calling this function — no new cron entries.
--
-- Run manually in the Supabase SQL editor, after 0051.
--
-- NOTE: the 500 below must stay in sync with GAME_KING_REWARD in
-- src/lib/games/constants.ts.
-- ============================================================================

alter table public.game_scores
  add column if not exists duration_seconds integer;

create or replace function public.award_game_kings()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _today date := (now() at time zone 'Europe/Brussels')::date;
  _game  text;
  _games text[] := array['flappy','tetris','2048','petconnect','usstates'];
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
