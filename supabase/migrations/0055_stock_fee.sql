-- ============================================================================
-- BibSync — "detox" the casino stock so it stops being a risk-free hoard.
--
-- Problem: the BIB-aandeel is a NAV fund backed by house profit, which only
-- ever trends up, so the optimal move is to park every coin in it forever. It
-- became a savings account with yield, not a coin sink — coins never leave.
--
-- Fix (A1): a daily management fee ("negative carry"). Each hourly fold now
-- also burns a slice of the treasury, so the price drifts DOWN unless house
-- profit refills it faster. Parking idle coins now costs you; the share becomes
-- a real bet on casino activity, and the burned slice is a genuine coin sink.
--
-- MANAGEMENT_FEE_DAILY = 0.01 mirrors src/lib/stock/config.ts. We apply the
-- 1/24 root each hour so it compounds to exactly the daily rate.
-- (The position cap A2 is enforced in the buyStock action, no schema needed.)
-- ============================================================================

create or replace function public.snapshot_casino_stock()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _net          bigint;
  _stock        record;
  _tre          double precision;
  _price        double precision;
  _hourly_keep  double precision := power(1 - 0.01, 1.0 / 24);  -- 1%/day burn
begin
  select net into _net from public.casino_stats();
  select * into _stock from public.casino_stock where id;

  if _stock.shares > 0 then
    -- Fold accrued house profit, then burn the hourly management fee.
    _tre := (_stock.treasury + (_net - _stock.baseline_net)) * _hourly_keep;
    update public.casino_stock
      set treasury = _tre, baseline_net = _net, updated_at = now()
      where id;
    _price := greatest(1, _tre / _stock.shares);
  else
    _price := 100;
  end if;

  insert into public.casino_stock_history (price, shares, net)
  values (_price, _stock.shares, _net);
end;
$$;

revoke execute on function public.snapshot_casino_stock() from public, authenticated;
grant execute on function public.snapshot_casino_stock() to service_role;
