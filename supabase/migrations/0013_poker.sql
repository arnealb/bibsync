-- ============================================================================
-- BibSync — per-room Texas Hold'em poker
--
-- Three tables with sharply different visibility:
--   * poker_tables    — PUBLIC table state (players, chips, community, pot,
--                       whose turn). Readable by every room member.
--   * poker_hole_cards — each player's two private cards. RLS lets you read
--                       ONLY your own; never added to realtime.
--   * poker_private   — the remaining deck for the current hand. No client
--                       may read it (would leak future cards). Service only.
--
-- All game mutations run server-side with the service-role key (RLS bypass)
-- after the action verifies membership and turn order, so clients only ever
-- read these tables — there are deliberately no client insert/update policies.
-- ============================================================================

create table if not exists public.poker_tables (
  room_id    uuid primary key references public.rooms(id) on delete cascade,
  state      jsonb not null,
  version    integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.poker_private (
  room_id uuid primary key references public.rooms(id) on delete cascade,
  hand_no integer not null,
  deck    jsonb not null
);

create table if not exists public.poker_hole_cards (
  room_id uuid not null references public.rooms(id) on delete cascade,
  hand_no integer not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  cards   text[] not null,
  primary key (room_id, hand_no, user_id)
);

alter table public.poker_tables enable row level security;
alter table public.poker_private enable row level security;
alter table public.poker_hole_cards enable row level security;

-- Public state: room members (and admins) may read; nobody writes from the client.
drop policy if exists "poker_tables_select_member" on public.poker_tables;
create policy "poker_tables_select_member" on public.poker_tables
  for select to authenticated
  using (public.is_room_member(room_id) or public.is_admin());

-- Hole cards: you may read only your own. No client writes.
drop policy if exists "poker_hole_cards_select_own" on public.poker_hole_cards;
create policy "poker_hole_cards_select_own" on public.poker_hole_cards
  for select to authenticated
  using (user_id = auth.uid() and public.is_room_member(room_id));

-- poker_private has RLS enabled and no policies, so authenticated clients can
-- neither read nor write it; only the service role (which bypasses RLS) can.

-- Realtime: only the public table state is broadcast.
alter publication supabase_realtime add table public.poker_tables;
