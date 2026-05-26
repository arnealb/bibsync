-- ============================================================================
-- BibSync — deel 4: per-room games library (Snake first)
-- Single table for all game scores; per-room/per-game high-score leaderboard.
-- Inserts only — keeps the leaderboard query trivial (max(score) per user).
-- ============================================================================

create table if not exists public.game_scores (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references public.rooms(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  game_key   text not null,
  score      integer not null check (score >= 0),
  created_at timestamptz not null default now()
);

create index if not exists game_scores_room_game_score_idx
  on public.game_scores (room_id, game_key, score desc);
create index if not exists game_scores_user_idx
  on public.game_scores (user_id);

alter table public.game_scores enable row level security;

-- Any member of the room can see all scores in that room (leaderboard).
create policy "game_scores_select_member" on public.game_scores
  for select to authenticated
  using (public.is_room_member(room_id) or public.is_admin());

-- A user can only insert a score for themselves in a room they belong to.
create policy "game_scores_insert_self" on public.game_scores
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_room_member(room_id));

-- Admin can delete (cleanup tool).
create policy "game_scores_delete_admin" on public.game_scores
  for delete to authenticated
  using (public.is_admin());

-- Realtime is NOT enabled in v1. revalidatePath after submit is enough.
