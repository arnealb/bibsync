-- ============================================================================
-- BibSync — deel 3: food voting ("wat gaan we eten?")
-- Mirrors the break-proposal stack (votes + comments + realtime) for a daily
-- "where do we eat" poll, on its own page.
-- ============================================================================

create table if not exists public.food_proposals (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references public.rooms(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  food_date  date not null,
  choice     text not null check (length(choice) between 1 and 60),
  note       text,
  created_at timestamptz not null default now()
);

create table if not exists public.food_votes (
  food_proposal_id uuid not null references public.food_proposals(id) on delete cascade,
  user_id          uuid not null references public.profiles(id) on delete cascade,
  vote             text not null check (vote in ('yes','maybe','no')),
  voted_at         timestamptz not null default now(),
  primary key (food_proposal_id, user_id)
);

create table if not exists public.food_comments (
  id               uuid primary key default gen_random_uuid(),
  food_proposal_id uuid not null references public.food_proposals(id) on delete cascade,
  room_id          uuid not null references public.rooms(id) on delete cascade,
  author_id        uuid not null references public.profiles(id),
  content          text not null check (length(content) between 1 and 500),
  created_at       timestamptz not null default now()
);

create index if not exists food_proposals_room_date_idx
  on public.food_proposals (room_id, food_date desc);
create index if not exists food_votes_proposal_idx
  on public.food_votes (food_proposal_id);
create index if not exists food_comments_proposal_idx
  on public.food_comments (food_proposal_id, created_at);

-- Is the caller a member of the room that owns this food proposal?
create or replace function public.can_access_food(_food_proposal_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.food_proposals f
    join public.room_members m on m.room_id = f.room_id
    where f.id = _food_proposal_id and m.user_id = auth.uid()
  );
$$;

alter table public.food_proposals enable row level security;
alter table public.food_votes    enable row level security;
alter table public.food_comments enable row level security;

alter table public.food_proposals replica identity full;
alter table public.food_comments  replica identity full;

-- food_proposals
create policy "food_proposals_select_member" on public.food_proposals
  for select to authenticated
  using (public.is_room_member(room_id) or public.is_admin());
create policy "food_proposals_insert_member" on public.food_proposals
  for insert to authenticated
  with check (created_by = auth.uid() and public.is_room_member(room_id));
create policy "food_proposals_delete_manager" on public.food_proposals
  for delete to authenticated
  using (
    created_by = auth.uid()
    or public.is_room_owner(room_id)
    or public.is_admin()
  );

-- food_votes
create policy "food_votes_select_member" on public.food_votes
  for select to authenticated
  using (public.can_access_food(food_proposal_id) or public.is_admin());
create policy "food_votes_insert_self" on public.food_votes
  for insert to authenticated
  with check (user_id = auth.uid() and public.can_access_food(food_proposal_id));
create policy "food_votes_update_self" on public.food_votes
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "food_votes_delete_self" on public.food_votes
  for delete to authenticated using (user_id = auth.uid());

-- food_comments
create policy "food_comments_select_member" on public.food_comments
  for select to authenticated
  using (public.is_room_member(room_id) or public.is_admin());
create policy "food_comments_insert_self" on public.food_comments
  for insert to authenticated
  with check (author_id = auth.uid() and public.is_room_member(room_id));
create policy "food_comments_delete_manager" on public.food_comments
  for delete to authenticated
  using (
    author_id = auth.uid()
    or public.is_room_owner(room_id)
    or public.is_admin()
  );

alter publication supabase_realtime add table public.food_proposals;
alter publication supabase_realtime add table public.food_votes;
alter publication supabase_realtime add table public.food_comments;
