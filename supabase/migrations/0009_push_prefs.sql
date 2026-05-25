-- ============================================================================
-- BibSync — more notification types: chat, comments, votes
-- Chat → whole room; comments/votes → the proposal's creator.
-- ============================================================================

alter table public.profiles
  add column if not exists notify_chat boolean not null default true;
alter table public.profiles
  add column if not exists notify_comments boolean not null default true;
alter table public.profiles
  add column if not exists notify_votes boolean not null default true;

-- Room-wide targets, now including the "chat" preference.
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
      or (_pref = 'chat' and p.notify_chat)
    );
$$;

-- Targets for a single user (the proposal creator), if they opted in.
create or replace function public.get_user_push_targets(
  _user_id uuid,
  _pref text
)
returns table (endpoint text, p256dh text, auth text)
language sql
security definer
set search_path = public
stable
as $$
  select s.endpoint, s.p256dh, s.auth
  from public.push_subscriptions s
  join public.profiles p on p.id = s.user_id
  where s.user_id = _user_id
    and s.user_id <> auth.uid()
    and (
      (_pref = 'comments' and p.notify_comments)
      or (_pref = 'votes' and p.notify_votes)
    );
$$;

revoke execute on function public.get_user_push_targets(uuid, text) from anon;
grant execute on function public.get_user_push_targets(uuid, text) to authenticated;
