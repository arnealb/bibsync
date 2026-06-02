-- ============================================================================
-- BibSync — allow stealing from the same victim again. The 0052 partial unique
-- index `thefts_one_pending_per_pair` forbade a second *pending* theft per
-- (thief, victim) pair forever, which clashed with the 1-hour app-level
-- re-steal window: the coins moved, then the INSERT hit the unique index and
-- the whole steal rolled back with a generic error. Drop the index — re-steals
-- are now gated only by the 1-hour `OPEN_THEFT_TTL_MS` check in the action, and
-- each pending theft stays independently claimable (claimRobbed pays 2× per
-- pending row), so this can't be abused to strand the victim's recovery.
-- ============================================================================

drop index if exists public.thefts_one_pending_per_pair;
