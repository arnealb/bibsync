-- ============================================================================
-- BibSync — the "schandpaal" (pillory). An owner/admin publicly shames a member
-- with a reason; everyone in the room sees a banner naming who's on the pillory
-- and why (e.g. "Flappy-farmer"). A row existing = on the pillory; deleting it
-- takes them off. Mirrors room_timeouts, but the banner is public, not private.
-- ============================================================================

create table if not exists public.room_pillory (
  room_id    uuid not null references public.rooms(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  reason     text,
  created_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

alter table public.room_pillory enable row level security;

drop policy if exists "room_pillory_select_member" on public.room_pillory;
create policy "room_pillory_select_member" on public.room_pillory
  for select to authenticated
  using (public.is_room_member(room_id) or public.is_admin());

drop policy if exists "room_pillory_insert_manager" on public.room_pillory;
create policy "room_pillory_insert_manager" on public.room_pillory
  for insert to authenticated
  with check (public.is_room_owner(room_id) or public.is_admin());

drop policy if exists "room_pillory_delete_manager" on public.room_pillory;
create policy "room_pillory_delete_manager" on public.room_pillory
  for delete to authenticated
  using (public.is_room_owner(room_id) or public.is_admin());

alter publication supabase_realtime add table public.room_pillory;
