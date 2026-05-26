-- ============================================================================
-- BibSync — destinations / walks for (non-food) break proposals.
-- A proposal can name where the group is heading and whether it's a walk.
-- Destinations are remembered per room as reusable presets (room_places),
-- which a later phase will extend with map routes.
-- ============================================================================

alter table public.break_proposals
  add column if not exists destination text,
  add column if not exists is_walk boolean not null default false;

create table if not exists public.room_places (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references public.rooms(id) on delete cascade,
  name       text not null,
  is_walk    boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (room_id, name)
);

create index if not exists room_places_room_idx on public.room_places (room_id);

alter table public.room_places enable row level security;

drop policy if exists "room_places_select_member" on public.room_places;
create policy "room_places_select_member" on public.room_places
  for select to authenticated
  using (public.is_room_member(room_id) or public.is_admin());

drop policy if exists "room_places_insert_member" on public.room_places;
create policy "room_places_insert_member" on public.room_places
  for insert to authenticated
  with check (public.is_room_member(room_id) and created_by = auth.uid());

drop policy if exists "room_places_delete_own" on public.room_places;
create policy "room_places_delete_own" on public.room_places
  for delete to authenticated
  using (
    created_by = auth.uid()
    or public.is_room_owner(room_id)
    or public.is_admin()
  );
