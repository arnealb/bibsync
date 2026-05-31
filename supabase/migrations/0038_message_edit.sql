-- ============================================================================
-- BibSync — edit & delete your own chat messages.
--   * edited_at      — set when a message is edited (shows a "bewerkt" hint).
--   * update/delete RLS — authors may change/remove only their own messages.
--   * replica identity full — so realtime UPDATE/DELETE events carry the row
--     (incl. room_id, needed for the room_id filter on DELETE).
-- ============================================================================

alter table public.messages
  add column if not exists edited_at timestamptz;

drop policy if exists "messages_update_own" on public.messages;
create policy "messages_update_own" on public.messages
  for update to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

drop policy if exists "messages_delete_own" on public.messages;
create policy "messages_delete_own" on public.messages
  for delete to authenticated
  using (author_id = auth.uid());

alter table public.messages replica identity full;
