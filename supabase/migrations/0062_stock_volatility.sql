-- ============================================================================
-- BibSync — BIB-aandeel volatility: the price must also FALL.
--
-- Problem: the stock is a NAV fund on casino house profit, which only grows
-- (house edge), so the chart is a monotone staircase and parking coins in the
-- fund is a guaranteed win. The 1%/day fee (0055) is far smaller than the
-- profit inflow whenever anyone gambles.
--
-- Fix: the hourly fold gains four steps, all plain treasury multipliers so the
-- NAV invariant (price = treasury / shares, payouts covered) holds:
--   1. profit skim  — only 25% of casino P&L (both signs) reaches holders;
--                     the rest is burned. Scales with activity → long-run
--                     EV ~neutral no matter how busy the casino is.
--   2. fee          — raised to 2%/day (hourly root, as in 0055).
--   3. noise        — lognormal, arithmetic mean exactly 1, ±1.6%/h typical,
--                     clamped to ±7%/tick. Independent per tick → no timing
--                     exploit.
--   4. events       — 1%/h crash (×0.55–0.80) or 2%/h rally (×1.10–1.225);
--                     0.01×(0.675−1) + 0.02×(1.1625−1) = 0 → EV-0.
--
-- Event ticks are logged in casino_stock_history.event for chart markers.
-- MIRROR of src/lib/stock/tick.ts + config.ts (this SQL is authoritative).
-- ============================================================================

alter table public.casino_stock_history
  add column if not exists event text
  check (event in ('crash', 'rally'));

create or replace function public.snapshot_casino_stock()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _net    bigint;
  _stock  record;
  _tre    double precision;
  _price  double precision;
  _keep   double precision := power(1 - 0.02, 1.0 / 24);  -- 2%/day fee
  _skim   double precision := 0.75;   -- share of casino P&L burned
  _sd     double precision := 0.016;  -- hourly lognormal sigma
  _z      double precision;
  _factor double precision;
  _roll   double precision;
  _event  text := null;
begin
  select net into _net from public.casino_stats();
  select * into _stock from public.casino_stock where id;

  if _stock.shares > 0 then
    -- 1. fold casino P&L, skimmed to 25% (the skimmed slice is burned)
    _tre := _stock.treasury + (_net - _stock.baseline_net) * (1 - _skim);
    -- 2. management fee (hourly root of the daily rate)
    _tre := _tre * _keep;
    -- 3. lognormal noise, arithmetic mean 1, clamped to ±7% per tick
    --    (1 - random() avoids ln(0); Box–Muller)
    _z := sqrt(-2 * ln(1 - random())) * cos(2 * pi() * random());
    _factor := exp(_sd * _z - _sd * _sd / 2);
    _factor := least(1.07, greatest(0.93, _factor));
    _tre := _tre * _factor;
    -- 4. event roll: 1% crash (−20…−45%), 2% rally (+10…+22.5%) — EV-0
    _roll := random();
    if _roll < 0.01 then
      _event := 'crash';
      _tre := _tre * (0.55 + random() * 0.25);
    elsif _roll < 0.03 then
      _event := 'rally';
      _tre := _tre * (1.10 + random() * 0.125);
    end if;
    _tre := greatest(0, _tre);

    update public.casino_stock
      set treasury = _tre, baseline_net = _net, updated_at = now()
      where id;
    _price := greatest(1, _tre / _stock.shares);
  else
    _price := 100;
  end if;

  insert into public.casino_stock_history (price, shares, net, event)
  values (_price, _stock.shares, _net, _event);
end;
$$;

revoke execute on function public.snapshot_casino_stock() from public, authenticated;
grant execute on function public.snapshot_casino_stock() to service_role;
