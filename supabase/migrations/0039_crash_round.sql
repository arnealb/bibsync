-- ============================================================================
-- BibSync — live single-player Crash. One round per (room, user). The rocket's
-- multiplier rises with wall-clock time from `started_at`; the player cashes out
-- live. The crash point is hidden in crash_private until the round ends, so the
-- client can animate the rise but never knows when it will blow.
--   * crash_rounds  — PUBLIC, owner-readable: bet, status, started_at, and the
--                     revealed crash/cashout once settled.
--   * crash_private — service-only crash point. RLS on, NO policies.
-- All writes go through the service role; settlement uses server time only.
-- ============================================================================

create table if not exists public.crash_rounds (
  room_id    uuid not null references public.rooms(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  bet        integer not null,
  status     text not null default 'running',
  started_at timestamptz not null default now(),
  crash_bp   integer,
  cashout_bp integer,
  payout     integer not null default 0,
  version    integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

alter table public.crash_rounds enable row level security;

drop policy if exists "crash_rounds_select_own" on public.crash_rounds;
create policy "crash_rounds_select_own" on public.crash_rounds
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- Hidden crash point: service-only, no policies.
create table if not exists public.crash_private (
  room_id  uuid not null references public.rooms(id) on delete cascade,
  user_id  uuid not null references public.profiles(id) on delete cascade,
  crash_bp integer not null,
  primary key (room_id, user_id)
);

alter table public.crash_private enable row level security;
