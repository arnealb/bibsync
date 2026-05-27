-- ============================================================================
-- BibSync — manual daily "I'm here today" check-in, an alternative to location
-- presence for people who won't share their location. A member counts as
-- present if location confirms it OR they checked in today (Brussels date).
-- No new RLS: members already update their own presence row.
-- ============================================================================

alter table public.presence
  add column if not exists checked_in_on date;
