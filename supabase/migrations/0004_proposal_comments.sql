-- ============================================================================
-- BibSync — deel 3: reactions (comments) on break proposals
-- room_id is denormalised so realtime can filter by room and RLS stays simple.
-- ============================================================================

create table if not exists public.proposal_comments (
  id          uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.break_proposals(id) on delete cascade,
  room_id     uuid not null references public.rooms(id) on delete cascade,
  author_id   uuid not null references public.profiles(id),
  content     text not null check (length(content) between 1 and 500),
  created_at  timestamptz not null default now()
);

create index if not exists proposal_comments_proposal_idx
  on public.proposal_comments (proposal_id, created_at);

alter table public.proposal_comments enable row level security;

-- FULL so realtime DELETE events include room_id (needed for the room filter).
alter table public.proposal_comments replica identity full;

-- Members of the room (and admins) can read.
drop policy if exists "proposal_comments_select_member" on public.proposal_comments;
create policy "proposal_comments_select_member"
  on public.proposal_comments for select to authenticated
  using (public.is_room_member(room_id) or public.is_admin());

-- Members post only as themselves.
drop policy if exists "proposal_comments_insert_self" on public.proposal_comments;
create policy "proposal_comments_insert_self"
  on public.proposal_comments for insert to authenticated
  with check (author_id = auth.uid() and public.is_room_member(room_id));

-- The author, the room owner or an admin may delete a comment.
drop policy if exists "proposal_comments_delete_own" on public.proposal_comments;
create policy "proposal_comments_delete_own"
  on public.proposal_comments for delete to authenticated
  using (
    author_id = auth.uid()
    or public.is_room_owner(room_id)
    or public.is_admin()
  );

alter publication supabase_realtime add table public.proposal_comments;
