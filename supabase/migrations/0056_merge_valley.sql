-- ============================================================================
-- BibSync — Merge Valley ("Bib-tuin"), a single-player merge puzzle. One board
-- per (room, user), like Mines. The whole board is public to its owner (no
-- hidden state — generator drops are revealed immediately), so there's no
-- *_private table. All writes go through the service role; the client never
-- mutates this table directly.
-- ============================================================================

create table if not exists public.merge_games (
  room_id    uuid not null references public.rooms(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  state      jsonb not null,
  version    integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

alter table public.merge_games enable row level security;

-- Owner (or admin) may read their own board; only the service role writes.
drop policy if exists "merge_games_select_own" on public.merge_games;
create policy "merge_games_select_own" on public.merge_games
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
