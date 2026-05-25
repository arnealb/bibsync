-- ============================================================================
-- BibSync — deel 3: admin role
--
-- An admin can see every room and its contents, and manage (rename / delete /
-- regenerate code / kick) any room. Permissive policies combine with OR, so we
-- ADD admin policies next to the existing member/owner ones.
-- ============================================================================

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

-- SECURITY DEFINER so it bypasses RLS (no recursion) while resolving auth.uid().
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_admin = true
  );
$$;

revoke execute on function public.is_admin() from anon;
grant execute on function public.is_admin() to authenticated;

-- Read access to everything for admins.
drop policy if exists "rooms_select_admin" on public.rooms;
create policy "rooms_select_admin" on public.rooms
  for select to authenticated using (public.is_admin());

drop policy if exists "room_members_select_admin" on public.room_members;
create policy "room_members_select_admin" on public.room_members
  for select to authenticated using (public.is_admin());

drop policy if exists "break_proposals_select_admin" on public.break_proposals;
create policy "break_proposals_select_admin" on public.break_proposals
  for select to authenticated using (public.is_admin());

drop policy if exists "votes_select_admin" on public.votes;
create policy "votes_select_admin" on public.votes
  for select to authenticated using (public.is_admin());

drop policy if exists "presence_select_admin" on public.presence;
create policy "presence_select_admin" on public.presence
  for select to authenticated using (public.is_admin());

drop policy if exists "messages_select_admin" on public.messages;
create policy "messages_select_admin" on public.messages
  for select to authenticated using (public.is_admin());

-- Management access (rename / regenerate / delete rooms, kick members).
drop policy if exists "rooms_update_admin" on public.rooms;
create policy "rooms_update_admin" on public.rooms
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "rooms_delete_admin" on public.rooms;
create policy "rooms_delete_admin" on public.rooms
  for delete to authenticated using (public.is_admin());

drop policy if exists "room_members_delete_admin" on public.room_members;
create policy "room_members_delete_admin" on public.room_members
  for delete to authenticated using (public.is_admin());

-- Promote a user to admin (replace the email):
--   update public.profiles set is_admin = true
--   where id = (select id from auth.users where email = 'admin@bibsync.test');
