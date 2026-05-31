-- ============================================================================
-- BibSync — peer-to-peer bibcoin transfers. One SECURITY DEFINER function moves
-- coins atomically: debit the sender, credit the recipient, two ledger rows, in
-- a single transaction. Idempotent on `_ref` (a double-submit can't pay twice).
-- Revoked from normal users; only the service role (server actions) may call it.
-- ============================================================================

create or replace function public.transfer_bibcoins(
  _sender uuid,
  _recipient uuid,
  _amount integer,
  _ref text
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  _balance integer;
begin
  if _amount <= 0 or _sender = _recipient then
    return false;
  end if;

  -- Ensure both wallets exist and lock the sender's row against races.
  insert into public.wallets (user_id) values (_sender)
    on conflict (user_id) do nothing;
  insert into public.wallets (user_id) values (_recipient)
    on conflict (user_id) do nothing;

  select bibcoins into _balance from public.wallets
    where user_id = _sender for update;

  if _balance < _amount then
    return false;
  end if;

  -- Claim the idempotency key on the debit row; a reused ref no-ops.
  insert into public.bibcoin_transactions (user_id, amount, reason, ref_key)
  values (_sender, -_amount, 'transfer-out', coalesce(_ref, ''))
  on conflict (user_id, reason, ref_key) do nothing;
  if not found then
    return false; -- already processed this transfer
  end if;

  update public.wallets set bibcoins = bibcoins - _amount where user_id = _sender;
  update public.wallets set bibcoins = bibcoins + _amount where user_id = _recipient;

  insert into public.bibcoin_transactions (user_id, amount, reason, ref_key)
  values (_recipient, _amount, 'transfer-in', coalesce(_ref, ''));

  return true;
end;
$$;

revoke execute on function public.transfer_bibcoins(uuid, uuid, integer, text)
  from public, authenticated;
grant execute on function public.transfer_bibcoins(uuid, uuid, integer, text)
  to service_role;
