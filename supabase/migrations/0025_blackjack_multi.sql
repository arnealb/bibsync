-- ============================================================================
-- BibSync — multiplayer (shared-table) Blackjack, replacing the single-player
-- `blackjack_games`. Mirrors the poker design:
--   * blackjack_tables  — PUBLIC masked state (seats, bets, hands, dealer up
--                         card, whose turn). Readable by every room member.
--   * blackjack_private — full server-side state (deck + dealer hole card).
--                         No client may read it; service role only.
-- All mutations run server-side with the service-role key after the action
-- verifies membership + turn order, so there are no client write policies.
-- The old `blackjack_games` table is left in place but unused.
-- ============================================================================

create table if not exists public.blackjack_tables (
  room_id    uuid primary key references public.rooms(id) on delete cascade,
  state      jsonb not null,
  version    integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.blackjack_private (
  room_id uuid primary key references public.rooms(id) on delete cascade,
  state   jsonb not null
);

alter table public.blackjack_tables enable row level security;
alter table public.blackjack_private enable row level security;

-- Public state: room members (and admins) may read; nobody writes from a client.
drop policy if exists "blackjack_tables_select_member" on public.blackjack_tables;
create policy "blackjack_tables_select_member" on public.blackjack_tables
  for select to authenticated
  using (public.is_room_member(room_id) or public.is_admin());

-- blackjack_private has RLS enabled and no policies, so authenticated clients
-- can neither read nor write it; only the service role (RLS bypass) can.

-- Realtime: only the public table state is broadcast.
alter publication supabase_realtime add table public.blackjack_tables;
