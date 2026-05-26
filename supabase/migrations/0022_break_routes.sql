-- ============================================================================
-- BibSync — map routes for break proposals (phase 2).
-- A proposal can carry a plotted route (array of {lat,lng}); saved places can
-- store a route too so they're reusable as defaults. Plain jsonb — validated
-- in the app.
-- ============================================================================

alter table public.break_proposals
  add column if not exists route_points jsonb;

alter table public.room_places
  add column if not exists points jsonb;
