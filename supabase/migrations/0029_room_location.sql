-- ============================================================================
-- BibSync — location-based presence ("is this person actually here?").
--   * rooms get an optional geofence: a centre (lat/lng) + radius in metres.
--   * presence rows get a location verdict: at_location (within the geofence)
--     and when it was last checked. The browser periodically sends its position
--     to `report_location`; the server compares against the room geofence and
--     stores only the boolean verdict (never the raw coordinates).
-- No new RLS: a member already may update their own presence row, and owners/
-- admins already may update their room.
-- ============================================================================

alter table public.rooms
  add column if not exists lat double precision,
  add column if not exists lng double precision,
  add column if not exists radius_m integer not null default 150;

alter table public.presence
  add column if not exists at_location boolean,
  add column if not exists location_checked_at timestamptz;
