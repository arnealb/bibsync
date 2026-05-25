-- ============================================================================
-- BibSync — initial schema (tables, RLS, triggers, indexes, realtime)
-- Run this once in the Supabase SQL Editor (see README.md).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Tables
-- ----------------------------------------------------------------------------

-- profiles (1-to-1 with auth.users)
create table if not exists public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  display_name text not null,
  avatar_url  text,
  created_at  timestamptz not null default now()
);

-- rooms
create table if not exists public.rooms (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  join_code   text unique not null,
  owner_id    uuid not null references public.profiles(id),
  created_at  timestamptz not null default now()
);

-- room_members
create table if not exists public.room_members (
  room_id   uuid not null references public.rooms(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

-- break_proposals
create table if not exists public.break_proposals (
  id               uuid primary key default gen_random_uuid(),
  room_id          uuid not null references public.rooms(id) on delete cascade,
  created_by       uuid not null references public.profiles(id),
  proposal_type    text not null check (proposal_type in ('lunch','dinner','coffee','other')),
  proposal_date    date not null,
  start_time       time not null,
  duration_minutes int not null check (duration_minutes > 0),
  note             text,
  created_at       timestamptz not null default now()
);

-- votes
create table if not exists public.votes (
  proposal_id uuid not null references public.break_proposals(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  vote        text not null check (vote in ('yes','maybe','no')),
  voted_at    timestamptz not null default now(),
  primary key (proposal_id, user_id)
);

-- presence
create table if not exists public.presence (
  room_id    uuid not null references public.rooms(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  status     text not null check (status in ('studying','break','lunch','away','done')),
  back_at    time,
  updated_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

-- messages
create table if not exists public.messages (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references public.rooms(id) on delete cascade,
  author_id  uuid not null references public.profiles(id),
  content    text not null check (length(content) between 1 and 2000),
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Indexes
-- ----------------------------------------------------------------------------

create index if not exists messages_room_created_idx
  on public.messages (room_id, created_at desc);
create index if not exists break_proposals_room_date_idx
  on public.break_proposals (room_id, proposal_date desc);
create index if not exists votes_proposal_idx
  on public.votes (proposal_id);
create index if not exists room_members_user_idx
  on public.room_members (user_id);

-- ----------------------------------------------------------------------------
-- Security-definer helpers (avoid RLS recursion on room_members)
--
-- These run with the definer's privileges and therefore BYPASS RLS, while
-- still resolving auth.uid() from the *caller's* JWT. This lets membership /
-- ownership checks be reused in policies without self-referential recursion.
-- ----------------------------------------------------------------------------

create or replace function public.is_room_member(_room_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.room_members
    where room_id = _room_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_room_owner(_room_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.rooms
    where id = _room_id and owner_id = auth.uid()
  );
$$;

-- Is the caller a member of the room that owns this proposal?
create or replace function public.can_access_proposal(_proposal_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.break_proposals p
    join public.room_members m on m.room_id = p.room_id
    where p.id = _proposal_id and m.user_id = auth.uid()
  );
$$;

-- ----------------------------------------------------------------------------
-- Enable Row Level Security
-- ----------------------------------------------------------------------------

alter table public.profiles        enable row level security;
alter table public.rooms           enable row level security;
alter table public.room_members    enable row level security;
alter table public.break_proposals enable row level security;
alter table public.votes           enable row level security;
alter table public.presence        enable row level security;
alter table public.messages        enable row level security;

-- ----------------------------------------------------------------------------
-- Policies — profiles
-- Readable by everyone (authenticated); only the owner may update.
-- ----------------------------------------------------------------------------

create policy "profiles_select_all"
  on public.profiles for select to authenticated
  using (true);

create policy "profiles_insert_self"
  on public.profiles for insert to authenticated
  with check (auth.uid() = id);

create policy "profiles_update_self"
  on public.profiles for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ----------------------------------------------------------------------------
-- Policies — rooms
-- A user sees rooms they own or are a member of. Only the owner mutates.
-- ----------------------------------------------------------------------------

create policy "rooms_select_member"
  on public.rooms for select to authenticated
  using (owner_id = auth.uid() or public.is_room_member(id));

create policy "rooms_insert_owner"
  on public.rooms for insert to authenticated
  with check (owner_id = auth.uid());

create policy "rooms_update_owner"
  on public.rooms for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "rooms_delete_owner"
  on public.rooms for delete to authenticated
  using (owner_id = auth.uid());

-- ----------------------------------------------------------------------------
-- Policies — room_members
-- See members of your rooms; join yourself; leave yourself or be kicked by owner.
-- ----------------------------------------------------------------------------

create policy "room_members_select_member"
  on public.room_members for select to authenticated
  using (public.is_room_member(room_id));

create policy "room_members_insert_self"
  on public.room_members for insert to authenticated
  with check (user_id = auth.uid());

create policy "room_members_delete_self_or_owner"
  on public.room_members for delete to authenticated
  using (user_id = auth.uid() or public.is_room_owner(room_id));

-- ----------------------------------------------------------------------------
-- Policies — break_proposals
-- Members read/create; only the creator deletes.
-- ----------------------------------------------------------------------------

create policy "break_proposals_select_member"
  on public.break_proposals for select to authenticated
  using (public.is_room_member(room_id));

create policy "break_proposals_insert_member"
  on public.break_proposals for insert to authenticated
  with check (created_by = auth.uid() and public.is_room_member(room_id));

create policy "break_proposals_delete_creator"
  on public.break_proposals for delete to authenticated
  using (created_by = auth.uid());

-- ----------------------------------------------------------------------------
-- Policies — votes
-- Members of the proposal's room read; users vote only as themselves (upsert).
-- ----------------------------------------------------------------------------

create policy "votes_select_member"
  on public.votes for select to authenticated
  using (public.can_access_proposal(proposal_id));

create policy "votes_insert_self"
  on public.votes for insert to authenticated
  with check (user_id = auth.uid() and public.can_access_proposal(proposal_id));

create policy "votes_update_self"
  on public.votes for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "votes_delete_self"
  on public.votes for delete to authenticated
  using (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- Policies — presence
-- Members read; users set only their own presence (upsert).
-- ----------------------------------------------------------------------------

create policy "presence_select_member"
  on public.presence for select to authenticated
  using (public.is_room_member(room_id));

create policy "presence_insert_self"
  on public.presence for insert to authenticated
  with check (user_id = auth.uid() and public.is_room_member(room_id));

create policy "presence_update_self"
  on public.presence for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "presence_delete_self"
  on public.presence for delete to authenticated
  using (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- Policies — messages
-- Members read; users post only as themselves. No edit/delete in v1.
-- ----------------------------------------------------------------------------

create policy "messages_select_member"
  on public.messages for select to authenticated
  using (public.is_room_member(room_id));

create policy "messages_insert_self"
  on public.messages for insert to authenticated
  with check (author_id = auth.uid() and public.is_room_member(room_id));

-- ----------------------------------------------------------------------------
-- Trigger — auto-create a profile when a new auth user is created
-- display_name from signup metadata, falling back to the email prefix.
-- ----------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data->>'display_name', ''),
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- Realtime — expose tables used by deel 2/3 (RLS still applies to changes)
-- ----------------------------------------------------------------------------

alter publication supabase_realtime add table public.break_proposals;
alter publication supabase_realtime add table public.votes;
alter publication supabase_realtime add table public.presence;
alter publication supabase_realtime add table public.messages;
