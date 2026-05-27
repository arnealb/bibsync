-- ============================================================================
-- BibSync — room "timeouts". An owner/admin can put a member in timeout; that
-- member then sees a red banner telling them to apologise. A row existing =
-- in timeout; deleting it lifts the timeout.
-- ============================================================================

create table if not exists public.room_timeouts (
  room_id    uuid not null references public.rooms(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  reason     text,
  created_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

alter table public.room_timeouts enable row level security;

-- Everyone in the room can read who's in timeout (so the banner shows live).
drop policy if exists "room_timeouts_select_member" on public.room_timeouts;
create policy "room_timeouts_select_member" on public.room_timeouts
  for select to authenticated
  using (public.is_room_member(room_id) or public.is_admin());

-- Only the room owner or an admin may put someone in / out of timeout.
drop policy if exists "room_timeouts_insert_manager" on public.room_timeouts;
create policy "room_timeouts_insert_manager" on public.room_timeouts
  for insert to authenticated
  with check (public.is_room_owner(room_id) or public.is_admin());

drop policy if exists "room_timeouts_delete_manager" on public.room_timeouts;
create policy "room_timeouts_delete_manager" on public.room_timeouts
  for delete to authenticated
  using (public.is_room_owner(room_id) or public.is_admin());

-- Live banner updates.
alter publication supabase_realtime add table public.room_timeouts;
