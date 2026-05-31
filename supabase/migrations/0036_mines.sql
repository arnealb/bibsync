-- ============================================================================
-- BibSync — single-player Mines (gok). One game per (room, user).
--   * mines_games   — PUBLIC, owner-readable state: bet, bomb count, opened
--                     tiles, status, multiplier, payout. Bomb positions are
--                     only written into `state.mines` once the game ends.
--   * mines_private — service-only bomb positions while the game is live. RLS
--                     on, NO policies (only the service role reads/writes).
-- All writes go through the service role; clients never mutate either table.
-- ============================================================================

create table if not exists public.mines_games (
  room_id    uuid not null references public.rooms(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  state      jsonb not null,
  version    integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

alter table public.mines_games enable row level security;

drop policy if exists "mines_games_select_own" on public.mines_games;
create policy "mines_games_select_own" on public.mines_games
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- Hidden bomb positions: service-only, no policies.
create table if not exists public.mines_private (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  mines   jsonb not null,
  primary key (room_id, user_id)
);

alter table public.mines_private enable row level security;
