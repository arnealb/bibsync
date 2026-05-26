-- ============================================================================
-- BibSync — step counting during breaks. Two sources:
--   'browser' — the in-app pedometer (phone accelerometer via DeviceMotion)
--   'health'  — real Apple Health steps POSTed by an Apple Shortcut to
--               /api/steps, authenticated with a per-user token.
-- Steps feed a per-room leaderboard and earn bibcoins (server-side, capped).
-- ============================================================================

create table if not exists public.step_sessions (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid not null references public.rooms(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  steps        integer not null check (steps >= 0 and steps <= 100000),
  source       text not null default 'browser'
                 check (source in ('browser', 'health')),
  recorded_for date not null default (now() at time zone 'Europe/Brussels')::date,
  created_at   timestamptz not null default now()
);

create index if not exists step_sessions_room_idx
  on public.step_sessions (room_id, recorded_for desc);
create index if not exists step_sessions_user_idx
  on public.step_sessions (user_id, recorded_for desc);

alter table public.step_sessions enable row level security;

-- Room members read everyone's sessions (the leaderboard is shared)...
drop policy if exists "step_sessions_select_member" on public.step_sessions;
create policy "step_sessions_select_member" on public.step_sessions
  for select to authenticated
  using (public.is_room_member(room_id));

-- ...and may insert only their own browser sessions in a room they belong to.
-- ('health' rows are inserted server-side with the service role.)
drop policy if exists "step_sessions_insert_own" on public.step_sessions;
create policy "step_sessions_insert_own" on public.step_sessions
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_room_member(room_id));

-- Per-user token that authenticates the Apple Shortcut → /api/steps POST.
create table if not exists public.health_tokens (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  token      text not null unique,
  created_at timestamptz not null default now()
);

alter table public.health_tokens enable row level security;

-- The owner may read their own token (to display it). No client writes:
-- (re)generation happens server-side with the service role.
drop policy if exists "health_tokens_select_own" on public.health_tokens;
create policy "health_tokens_select_own" on public.health_tokens
  for select to authenticated using (user_id = auth.uid());

-- Live leaderboard updates.
alter publication supabase_realtime add table public.step_sessions;
