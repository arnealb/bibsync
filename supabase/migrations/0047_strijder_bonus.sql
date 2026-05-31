-- ============================================================================
-- BibSync — "Strijder bonus": 1000 bibcoins for being online between 00:30 and
-- 01:30 Brussels (a reward for late-night study warriors). Once per Brussels
-- day, server-checked time window, idempotent via the ledger. SECURITY DEFINER,
-- service-role only.
-- ============================================================================

create or replace function public.claim_strijder_bonus(_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  _bx    timestamp := now() at time zone 'Europe/Brussels';
  _mins  int := extract(hour from _bx)::int * 60 + extract(minute from _bx)::int;
  _today date := _bx::date;
  _grant int := 1000;
begin
  -- Window: 00:30 (>=30 min) up to but not incl. 01:30 (<90 min).
  if _mins < 30 or _mins >= 90 then
    return 0;
  end if;

  insert into public.bibcoin_transactions (user_id, amount, reason, ref_key)
  values (_user_id, _grant, 'strijder', _today::text)
  on conflict (user_id, reason, ref_key) do nothing;
  if not found then
    return 0; -- already claimed today
  end if;

  insert into public.wallets (user_id, bibcoins) values (_user_id, 2000 + _grant)
  on conflict (user_id) do update
    set bibcoins = public.wallets.bibcoins + _grant;
  return _grant;
end;
$$;

revoke execute on function public.claim_strijder_bonus(uuid) from public, authenticated;
grant execute on function public.claim_strijder_bonus(uuid) to service_role;
