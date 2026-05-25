-- ============================================================================
-- BibSync — add a time to food proposals ("om hoe laat eten we?")
-- Nullable so existing rows keep working; new proposals set it.
-- ============================================================================

alter table public.food_proposals
  add column if not exists food_time time;
