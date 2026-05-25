-- ============================================================================
-- BibSync — instant break ("Pauze nu")
-- Two distinct members pressing the button within a short rolling window
-- declare an immediate break for the whole room, regardless of what is
-- scheduled. Pushes are recorded individually; the break itself is a separate
-- row so realtime can broadcast a single "it's break time now" event.
-- ============================================================================

create table if not exists public.instant_break_pushes (
  id               uuid primary key default gen_random_uuid(),
  room_id          uuid not null references public.rooms(id) on delete cascade,
  user_id          uuid not null references public.profiles(id) on delete cascade,
  duration_minutes integer not null,
  created_at       timestamptz not null default now()
);

create index if not exists instant_break_pushes_room_idx
  on public.instant_break_pushes (room_id, created_at desc);

create table if not exists public.instant_breaks (
  id               uuid primary key default gen_random_uuid(),
  room_id          uuid not null references public.rooms(id) on delete cascade,
  triggered_by     uuid not null references public.profiles(id) on delete cascade,
  duration_minutes integer not null,
  started_at       timestamptz not null default now(),
  created_at       timestamptz not null default now()
);

create index if not exists instant_breaks_room_idx
  on public.instant_breaks (room_id, started_at desc);

alter table public.instant_break_pushes enable row level security;
alter table public.instant_breaks enable row level security;

-- Pushes: members see them, members insert only their own.
drop policy if exists "instant_break_pushes_select_member" on public.instant_break_pushes;
create policy "instant_break_pushes_select_member" on public.instant_break_pushes
  for select to authenticated
  using (public.is_room_member(room_id) or public.is_admin());

drop policy if exists "instant_break_pushes_insert_self" on public.instant_break_pushes;
create policy "instant_break_pushes_insert_self" on public.instant_break_pushes
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_room_member(room_id));

-- Breaks: members see them, members can declare one.
drop policy if exists "instant_breaks_select_member" on public.instant_breaks;
create policy "instant_breaks_select_member" on public.instant_breaks
  for select to authenticated
  using (public.is_room_member(room_id) or public.is_admin());

drop policy if exists "instant_breaks_insert_member" on public.instant_breaks;
create policy "instant_breaks_insert_member" on public.instant_breaks
  for insert to authenticated
  with check (triggered_by = auth.uid() and public.is_room_member(room_id));

alter publication supabase_realtime add table public.instant_break_pushes;
alter publication supabase_realtime add table public.instant_breaks;
