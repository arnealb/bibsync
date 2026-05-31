-- ============================================================================
-- BibSync — per-room lottery. One round per room: players buy bibcoin tickets,
-- the pot grows, and once the countdown ends a weighted-random winner takes the
-- pot. Public state only (no hidden info — the winner is chosen server-side at
-- draw time), readable by room members, broadcast over realtime. All writes go
-- through the service role.
-- ============================================================================

create table if not exists public.lottery_rounds (
  room_id    uuid primary key references public.rooms(id) on delete cascade,
  state      jsonb not null,
  version    integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.lottery_rounds enable row level security;

drop policy if exists "lottery_rounds_select_member" on public.lottery_rounds;
create policy "lottery_rounds_select_member" on public.lottery_rounds
  for select to authenticated
  using (public.is_room_member(room_id) or public.is_admin());

alter publication supabase_realtime add table public.lottery_rounds;
