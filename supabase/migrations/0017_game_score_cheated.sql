-- ============================================================================
-- BibSync — mark game scores achieved with the (hidden) Snake autopilot, so the
-- leaderboard can be viewed honestly (cheated runs filtered out via /honest).
-- ============================================================================

alter table public.game_scores
  add column if not exists cheated boolean not null default false;
