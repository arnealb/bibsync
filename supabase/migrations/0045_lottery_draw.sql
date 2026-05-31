-- ============================================================================
-- BibSync — daily lottery draw. Every day at 22:00 Brussels a weighted-random
-- winner takes each room's pot, then a fresh round opens immediately (so the
-- next draw is the following day at 22:00). Runs in SQL via pg_cron so it fires
-- regardless of who's online. Two UTC schedules (20:00 / 21:00) cover DST; the
-- function only acts during the 22:00 Brussels hour, so exactly one fires.
-- ============================================================================

create extension if not exists pg_cron;

create or replace function public.run_lottery_draws()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _row    record;
  _state  jsonb;
  _total  int;
  _pick   int;
  _acc    int;
  _winner uuid;
  _prize  int;
  _t      record;
begin
  if extract(hour from now() at time zone 'Europe/Brussels')::int <> 22 then
    return; -- the off-DST cron run; not the 22:00 Brussels hour
  end if;

  for _row in select room_id, state from public.lottery_rounds loop
    _state := _row.state;
    _total := coalesce((
      select sum((e->>'count')::int)
      from jsonb_array_elements(_state->'tickets') e
    ), 0);

    _winner := null;
    _prize := 0;
    if _total >= 1 then
      _pick := floor(random() * _total);
      _acc := 0;
      for _t in
        select (e->>'userId') as uid, (e->>'count')::int as cnt
        from jsonb_array_elements(_state->'tickets') e
      loop
        if _pick < _acc + _t.cnt then
          _winner := _t.uid::uuid;
          exit;
        end if;
        _acc := _acc + _t.cnt;
      end loop;
      _prize := coalesce((_state->>'pot')::int, 0);
      if _winner is not null and _prize > 0 then
        perform public.award_bibcoins(
          _winner, _prize, 'lottery_prize',
          _row.room_id::text || ':' || (_state->>'roundNo')
        );
      end if;
    end if;

    update public.lottery_rounds
      set state = jsonb_build_object(
            'roundNo', coalesce((_state->>'roundNo')::int, 0) + 1,
            'tickets', '[]'::jsonb,
            'pot', 0,
            'lastWinnerId', to_jsonb(_winner),
            'lastPrize', _prize
          ),
          version = version + 1,
          updated_at = now()
    where room_id = _row.room_id;
  end loop;
end;
$$;

revoke execute on function public.run_lottery_draws() from public, authenticated;
grant execute on function public.run_lottery_draws() to service_role;

do $$
begin
  perform cron.unschedule('lottery-draw-a');
exception when others then null;
end $$;
do $$
begin
  perform cron.unschedule('lottery-draw-b');
exception when others then null;
end $$;

select cron.schedule('lottery-draw-a', '0 20 * * *',
  $$select public.run_lottery_draws()$$);
select cron.schedule('lottery-draw-b', '0 21 * * *',
  $$select public.run_lottery_draws()$$);
