-- ============================================================================
-- BibSync — Paardenraces v2: live minute race + podium payouts.
--
-- 1st, 2nd AND 3rd now pay out. The resolver draws the FULL finishing order
-- via sequential weighted sampling without replacement (Plackett–Luce, with
-- the stored winBp as weights) and stores it in `finish_order`; clients
-- animate a one-minute live race from `run_seed`, anchored to `runs_at`, so
-- everyone watches the same race in real time (cosmetic — betting closed at
-- the :00 draw).
--
-- Odds per podium spot are fixed at race creation: mult_k = α_k / P(k-th)
-- with α = 70% / 15% / 10% (summing to 95% = 1 − house edge), where P(2nd)
-- and P(3rd) are the exact Plackett–Luce place probabilities. EV is then
-- exactly 95% of the stake for every horse, before payout flooring.
--
-- Races opened before this migration only carry the legacy win-only multBp:
-- the resolver falls back to it (winner paid, places 0), matching the odds
-- those bettors saw. MIRROR of src/lib/horses/ (EV guard tests) — SQL
-- authoritative. Run manually in the Supabase SQL editor, after 0066.
-- ============================================================================

alter table public.horse_races add column if not exists finish_order integer[];

-- ----------------------------------------------------------------------------
-- open_horse_race(runs_at) — as in 0066, plus exact podium odds per horse.
-- ----------------------------------------------------------------------------
create or replace function public.open_horse_race(_runs_at timestamptz)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _colors   text[] := array['red','blue','green','yellow','purple','orange'];
  _speed    int[];
  _stamina  int[];
  _sprint   int[];
  _weight   numeric[];
  _sum      numeric := 0;
  _win      int[];
  _acc      int := 0;
  _short    int := 0;
  _maxi     int := 1;
  _horses   jsonb := '[]'::jsonb;
  _strength numeric;
  _p1       numeric;
  _p2       numeric;
  _p3       numeric;
begin
  for i in 1..6 loop
    _speed[i]   := 40 + floor(random() * 60)::int;
    _stamina[i] := 40 + floor(random() * 60)::int;
    _sprint[i]  := 40 + floor(random() * 60)::int;
    _strength   := 0.45 * _speed[i] + 0.35 * _stamina[i] + 0.20 * _sprint[i];
    _weight[i]  := power(_strength, 4);
    _sum        := _sum + _weight[i];
  end loop;

  -- Win chances in basis points; the last horse absorbs rounding.
  for i in 1..5 loop
    _win[i] := floor(10000 * _weight[i] / _sum)::int;
    _acc    := _acc + _win[i];
  end loop;
  _win[6] := 10000 - _acc;

  -- Floor longshots at 200 bp (2%), paid for by the favourite, so the odds
  -- keep the uniform 5% edge for every horse.
  for i in 1..6 loop
    if _win[i] > _win[_maxi] then _maxi := i; end if;
  end loop;
  for i in 1..6 loop
    if _win[i] < 200 then
      _short  := _short + (200 - _win[i]);
      _win[i] := 200;
    end if;
  end loop;
  _win[_maxi] := _win[_maxi] - _short;

  -- Exact Plackett–Luce place probabilities → fixed podium odds.
  for i in 1..6 loop
    _p1 := _win[i]::numeric / 10000;
    _p2 := 0;
    _p3 := 0;
    for j in 1..6 loop
      if j <> i then
        _p2 := _p2 + (_win[j]::numeric / 10000)
                   * _win[i]::numeric / (10000 - _win[j]);
        for k in 1..6 loop
          if k <> i and k <> j then
            _p3 := _p3 + (_win[j]::numeric / 10000)
                       * (_win[k]::numeric / (10000 - _win[j]))
                       * (_win[i]::numeric / (10000 - _win[j] - _win[k]));
          end if;
        end loop;
      end if;
    end loop;

    _horses := _horses || jsonb_build_object(
      'color',   _colors[i],
      'speed',   _speed[i],
      'stamina', _stamina[i],
      'sprint',  _sprint[i],
      'winBp',   _win[i],
      -- α_k/p_k in bp (α·10000 / p), floored, ×50 sanity cap
      'mult1Bp', least(floor(7000.0 / _p1)::int, 500000),
      'mult2Bp', least(floor(1500.0 / _p2)::int, 500000),
      'mult3Bp', least(floor(1000.0 / _p3)::int, 500000)
    );
  end loop;

  insert into public.horse_races (runs_at, horses, name_seed)
  values (_runs_at, _horses, floor(random() * 1000000000)::int)
  on conflict (runs_at) do nothing;
end;
$$;

-- ----------------------------------------------------------------------------
-- run_horse_races() — draw the full finishing order, pay the podium.
-- ----------------------------------------------------------------------------
create or replace function public.run_horse_races()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _race      record;
  _bet       record;
  _weights   int[];
  _order     int[];
  _remaining int[];
  _total     int;
  _pick      numeric;
  _acc       int;
  _m1        int;
  _m2        int;
  _m3        int;
  _mult      int;
  _payout    int;
begin
  for _race in
    select * from public.horse_races
    where status = 'open' and runs_at <= now()
    order by runs_at
    for update
  loop
    _weights := array[]::int[];
    for i in 0..5 loop
      _weights := _weights || ((_race.horses->i)->>'winBp')::int;
    end loop;

    -- Sequential weighted draw without replacement (Plackett–Luce).
    _remaining := array[0,1,2,3,4,5];
    _order := array[]::int[];
    for pos in 1..6 loop
      _total := 0;
      for j in 1..array_length(_remaining, 1) loop
        _total := _total + _weights[_remaining[j] + 1];
      end loop;
      _pick := random() * _total;
      _acc := 0;
      for j in 1..array_length(_remaining, 1) loop
        _acc := _acc + _weights[_remaining[j] + 1];
        if _pick < _acc then
          _order := _order || _remaining[j];
          _remaining := _remaining[1:j-1] || _remaining[j+1:];
          exit;
        end if;
      end loop;
    end loop;

    update public.horse_races
      set status = 'resolved',
          winner_idx = _order[1],
          finish_order = _order,
          run_seed = floor(random() * 2147483647)::int
    where id = _race.id;

    -- Podium odds; legacy (pre-0067) races fall back to win-only multBp.
    _m1 := coalesce(
      ((_race.horses->_order[1])->>'mult1Bp')::int,
      ((_race.horses->_order[1])->>'multBp')::int,
      0
    );
    _m2 := coalesce(((_race.horses->_order[2])->>'mult2Bp')::int, 0);
    _m3 := coalesce(((_race.horses->_order[3])->>'mult3Bp')::int, 0);

    for _bet in
      select * from public.horse_race_bets where race_id = _race.id
    loop
      _mult := case _bet.horse_idx
        when _order[1] then _m1
        when _order[2] then _m2
        when _order[3] then _m3
        else 0
      end;
      _payout := floor(_bet.amount::numeric * _mult / 10000)::int;
      if _payout > 0 then
        perform public.award_bibcoins(
          _bet.user_id, _payout, 'horses_payout', _bet.id::text
        );
      end if;
      update public.horse_race_bets set payout = _payout where id = _bet.id;
    end loop;
  end loop;

  perform public.open_horse_race(date_trunc('hour', now()) + interval '1 hour');
end;
$$;

-- create or replace keeps the ACLs from 0066, but re-state them defensively.
revoke execute on function public.open_horse_race(timestamptz) from public, authenticated;
revoke execute on function public.run_horse_races() from public, authenticated;
grant execute on function public.open_horse_race(timestamptz) to service_role;
grant execute on function public.run_horse_races() to service_role;
