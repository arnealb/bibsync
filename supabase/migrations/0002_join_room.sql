-- ============================================================================
-- BibSync — deel 2: join a room by code
--
-- Joining needs to look up a room the caller is NOT yet a member of, which the
-- rooms RLS SELECT policy blocks. This SECURITY DEFINER function performs the
-- lookup + membership insert atomically, bypassing RLS safely.
-- ============================================================================

create or replace function public.join_room(_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _room_id uuid;
begin
  select id into _room_id
  from public.rooms
  where join_code = upper(trim(_code));

  if _room_id is null then
    return null;
  end if;

  insert into public.room_members (room_id, user_id)
  values (_room_id, auth.uid())
  on conflict (room_id, user_id) do nothing;

  return _room_id;
end;
$$;

-- Only logged-in users may call it.
revoke execute on function public.join_room(text) from anon;
grant execute on function public.join_room(text) to authenticated;
