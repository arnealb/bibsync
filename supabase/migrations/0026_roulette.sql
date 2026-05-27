-- ============================================================================
-- BibSync — multiplayer (shared-table) roulette. One table per room: players
-- place bibcoin bets during a timed window, then one spin resolves everyone.
--   * roulette_tables — PUBLIC state (round, phase, deadline, all bets, the
--                       winning number + per-player results). Readable by every
--                       room member; broadcast over realtime.
-- There is no hidden state: the winning number is chosen server-side only at
-- resolution, so showing live bets can't leak it. All writes go through the
-- service role (no client write policies).
-- ============================================================================

create table if not exists public.roulette_tables (
  room_id    uuid primary key references public.rooms(id) on delete cascade,
  state      jsonb not null,
  version    integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.roulette_tables enable row level security;

drop policy if exists "roulette_tables_select_member" on public.roulette_tables;
create policy "roulette_tables_select_member" on public.roulette_tables
  for select to authenticated
  using (public.is_room_member(room_id) or public.is_admin());

-- Realtime: the public table state is broadcast.
alter publication supabase_realtime add table public.roulette_tables;
