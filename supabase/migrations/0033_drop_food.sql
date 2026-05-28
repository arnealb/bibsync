-- 0033_drop_food.sql
-- Remove the food ("Wat eten we?") feature entirely (was 0005 / 0007).
-- DESTRUCTIVE: drops all food voting data. Run in the Supabase SQL editor.

-- Drop the tables (cascade also removes them from supabase_realtime + policies).
drop table if exists public.food_comments cascade;
drop table if exists public.food_votes cascade;
drop table if exists public.food_proposals cascade;

-- Helper that scoped food RLS is no longer referenced anywhere.
drop function if exists public.can_access_food(uuid);

-- Recreate the room push-target function without the now-gone food branch,
-- so dropping notify_food below doesn't leave it referencing a missing column.
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
      or (_pref = 'chat' and p.notify_chat)
    );
$$;

-- The food notification preference is meaningless now.
alter table public.profiles drop column if exists notify_food;
