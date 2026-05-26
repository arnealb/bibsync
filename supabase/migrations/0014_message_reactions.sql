-- ============================================================================
-- BibSync — emoji reactions on chat messages
-- room_id is denormalised so realtime can filter by room and RLS stays simple.
-- ============================================================================

create table if not exists public.message_reactions (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  emoji      text not null,
  room_id    uuid not null references public.rooms(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);

create index if not exists message_reactions_message_idx
  on public.message_reactions (message_id);

alter table public.message_reactions enable row level security;
alter table public.message_reactions replica identity full;

drop policy if exists "message_reactions_select_member" on public.message_reactions;
create policy "message_reactions_select_member" on public.message_reactions
  for select to authenticated
  using (public.is_room_member(room_id) or public.is_admin());

drop policy if exists "message_reactions_insert_self" on public.message_reactions;
create policy "message_reactions_insert_self" on public.message_reactions
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_room_member(room_id));

drop policy if exists "message_reactions_delete_self" on public.message_reactions;
create policy "message_reactions_delete_self" on public.message_reactions
  for delete to authenticated using (user_id = auth.uid());

alter publication supabase_realtime add table public.message_reactions;
