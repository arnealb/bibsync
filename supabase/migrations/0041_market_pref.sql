-- ============================================================================
-- BibSync — push for the klussenmarkt + fix per-user chat pushes.
--   * notify_market — opt-out for marketplace pings (bid / hired / accepted).
--   * get_user_push_targets gains the 'market' and 'chat' branches. ('chat'
--     was already used by @mention pushes but the function never matched it, so
--     those pings silently went nowhere — fixed here.)
-- ============================================================================

alter table public.profiles
  add column if not exists notify_market boolean not null default true;

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
      or (_pref = 'chat' and p.notify_chat)
      or (_pref = 'market' and p.notify_market)
    );
$$;

revoke execute on function public.get_user_push_targets(uuid, text) from anon;
grant execute on function public.get_user_push_targets(uuid, text) to authenticated;
