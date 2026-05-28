-- 0034_public_profile.sql
-- Public profile pages: let any signed-in user view another user's stats
-- (balance + activity counts) and the cosmetics they own.
-- Run in the Supabase SQL editor, after 0033.

-- Aggregated, read-only profile stats. SECURITY DEFINER so it reads across RLS
-- (wallets is own-only; proposals/comments/messages are member-scoped) and
-- returns honest global totals. Exposes only counts + balance, nothing else.
create or replace function public.get_profile_stats(_user_id uuid)
returns table (
  bibcoins  integer,
  proposals bigint,
  comments  bigint,
  messages  bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select
    coalesce(
      (select w.bibcoins from public.wallets w where w.user_id = _user_id),
      2000
    ),
    (select count(*) from public.break_proposals p where p.created_by = _user_id),
    (select count(*) from public.proposal_comments c where c.author_id = _user_id),
    (select count(*) from public.messages m where m.author_id = _user_id);
$$;

revoke execute on function public.get_profile_stats(uuid) from public;
grant  execute on function public.get_profile_stats(uuid) to authenticated;

-- Owned cosmetics become readable by everyone (the equipped loadout already is),
-- so a profile page can show what someone has bought in the shop.
drop policy if exists "cosmetics_select_own" on public.user_cosmetics;
create policy "cosmetics_select_all" on public.user_cosmetics
  for select to authenticated using (true);
