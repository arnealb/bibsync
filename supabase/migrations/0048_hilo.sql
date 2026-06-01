-- ============================================================================
-- BibSync — single-player Hi-Lo (hoger/lager). One game per (room, user).
--   * hilo_games   — PUBLIC, owner-readable state: bet, current card, running
--                    multiplier, status. The NEXT card stays hidden until you
--                    guess.
--   * hilo_private — service-only next card. RLS on, NO policies.
-- All writes go through the service role; version-guarded.
-- ============================================================================

create table if not exists public.hilo_games (
  room_id    uuid not null references public.rooms(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  state      jsonb not null,
  version    integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

alter table public.hilo_games enable row level security;

drop policy if exists "hilo_games_select_own" on public.hilo_games;
create policy "hilo_games_select_own" on public.hilo_games
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create table if not exists public.hilo_private (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  next    integer not null,
  primary key (room_id, user_id)
);

alter table public.hilo_private enable row level security;
