-- ============================================================================
-- BibSync — photos in chat. Public "chat-photos" bucket; each user uploads
-- under their own {uid}/ folder. Photos are kept for 3 days, then a daily
-- pg_cron job removes them (the message stays but the image expires).
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('chat-photos', 'chat-photos', true)
on conflict (id) do nothing;

drop policy if exists "chat_photos_public_read" on storage.objects;
create policy "chat_photos_public_read" on storage.objects
  for select to public
  using (bucket_id = 'chat-photos');

drop policy if exists "chat_photos_insert_own" on storage.objects;
create policy "chat_photos_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'chat-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "chat_photos_delete_own" on storage.objects;
create policy "chat_photos_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'chat-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Daily cleanup: drop chat photos older than 3 days. Requires pg_cron
-- (enable it once in Supabase → Database → Extensions if needed).
create extension if not exists pg_cron;

do $$
begin
  perform cron.unschedule('chat-photos-cleanup');
exception
  when others then null; -- not scheduled yet
end $$;

select cron.schedule(
  'chat-photos-cleanup',
  '17 3 * * *',
  $$delete from storage.objects
      where bucket_id = 'chat-photos'
        and created_at < now() - interval '3 days'$$
);
