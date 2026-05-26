-- ============================================================================
-- BibSync — shared per-room leaderboard setting. Any member can flip whether
-- cheated (autopilot) runs are shown, and the change applies for EVERYONE
-- (broadcast via realtime). Default: show everything (cheated runs flagged).
-- ============================================================================

create table if not exists public.room_leaderboard_settings (
  room_id      uuid primary key references public.rooms(id) on delete cascade,
  show_cheated boolean not null default true,
  updated_at   timestamptz not null default now()
);

alter table public.room_leaderboard_settings enable row level security;

drop policy if exists "rls_select_member" on public.room_leaderboard_settings;
create policy "rls_select_member" on public.room_leaderboard_settings
  for select to authenticated
  using (public.is_room_member(room_id) or public.is_admin());

drop policy if exists "rls_insert_member" on public.room_leaderboard_settings;
create policy "rls_insert_member" on public.room_leaderboard_settings
  for insert to authenticated
  with check (public.is_room_member(room_id));

drop policy if exists "rls_update_member" on public.room_leaderboard_settings;
create policy "rls_update_member" on public.room_leaderboard_settings
  for update to authenticated
  using (public.is_room_member(room_id))
  with check (public.is_room_member(room_id));

alter publication supabase_realtime add table public.room_leaderboard_settings;
