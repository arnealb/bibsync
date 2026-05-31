-- 0035_display_name_change.sql
-- Paid, once-per-day display-name changes.
-- Records the Brussels date of the user's last name change so the server action
-- can enforce the daily limit. The 500-bibcoin charge runs server-side via the
-- existing spend_bibcoins RPC; the self-update RLS policy from 0001 already lets
-- a user update their own profile row, so no new policy is needed.

alter table public.profiles
  add column if not exists display_name_changed_on date;

comment on column public.profiles.display_name_changed_on is
  'Brussels date of the user''s last paid display-name change; one change per day.';
