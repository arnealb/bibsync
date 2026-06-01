-- ============================================================================
-- BibSync — stealing moves to the (global) profile page, so a theft is no
-- longer tied to a room. Make thefts.room_id optional; existing rows keep their
-- room. Everything else (claim window, casino_stats penalty) is unchanged.
-- ============================================================================

alter table public.thefts alter column room_id drop not null;
