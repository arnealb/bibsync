-- ============================================================================
-- BibSync — Web Push notifications
-- Stores push subscriptions per user + per-user notification preferences.
-- ============================================================================

alter table public.profiles
  add column if not exists notify_proposals boolean not null default true;
alter table public.profiles
  add column if not exists notify_food boolean not null default true;

create table if not exists public.push_subscriptions (
  endpoint   text primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- A user manages only their own subscriptions.
drop policy if exists "push_select_own" on public.push_subscriptions;
create policy "push_select_own" on public.push_subscriptions
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "push_insert_own" on public.push_subscriptions;
create policy "push_insert_own" on public.push_subscriptions
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "push_update_own" on public.push_subscriptions;
create policy "push_update_own" on public.push_subscriptions
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "push_delete_own" on public.push_subscriptions;
create policy "push_delete_own" on public.push_subscriptions
  for delete to authenticated using (user_id = auth.uid());

-- Returns push targets (endpoint + keys) for the members of a room who opted in
-- to the given preference, excluding the caller. SECURITY DEFINER so it can read
-- other members' subscriptions, but only when the caller is a room member.
create or replace function public.get_push_targets(_room_id uuid, _pref text)
returns table (endpoint text, p256dh text, auth text)
language sql
security definer
set search_path = public
stable
as $$
  select s.endpoint, s.p256dh, s.auth
  from public.push_subscriptions s
  join public.room_members m
    on m.user_id = s.user_id and m.room_id = _room_id
  join public.profiles p on p.id = s.user_id
  where public.is_room_member(_room_id)
    and s.user_id <> auth.uid()
    and (
      (_pref = 'proposals' and p.notify_proposals)
      or (_pref = 'food' and p.notify_food)
    );
$$;

revoke execute on function public.get_push_targets(uuid, text) from anon;
grant execute on function public.get_push_targets(uuid, text) to authenticated;
