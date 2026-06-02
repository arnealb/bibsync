-- ============================================================================
-- BibSync — let room members see each other's screen time (for the per-room
-- "Schermtijd" overview tab). Screen time is global per user, so we gate the
-- read on "do these two users share at least one room". A SECURITY DEFINER
-- helper does the room_members lookup (bypasses RLS → no recursion), and a
-- second permissive SELECT policy ORs in alongside the existing self policy.
-- ============================================================================

create or replace function public.shares_room(_a uuid, _b uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.room_members m1
    join public.room_members m2 on m1.room_id = m2.room_id
    where m1.user_id = _a and m2.user_id = _b
  );
$$;

revoke execute on function public.shares_room(uuid, uuid) from public;
grant execute on function public.shares_room(uuid, uuid) to authenticated;

drop policy if exists screen_time_roommates on public.screen_time;
create policy screen_time_roommates on public.screen_time
  for select using (public.shares_room(auth.uid(), user_id));
