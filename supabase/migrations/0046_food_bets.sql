-- ============================================================================
-- BibSync — bet bibcoins on where to eat. For the fixed lunch/dinner moments
-- members stake bibcoins on an eating place; the place with the most staked
-- coins is where the group eats. Append-only stake rows (totals are summed
-- client-side); the coins are spent (a sink) by the server action.
--   * SELECT for room members; INSERT your own rows. Realtime broadcast.
-- ============================================================================

create table if not exists public.food_place_bets (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references public.rooms(id) on delete cascade,
  slot_date  date not null,
  slot_key   text not null,
  place      text not null,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  amount     integer not null check (amount > 0),
  created_at timestamptz not null default now()
);

create index if not exists food_place_bets_room_idx
  on public.food_place_bets (room_id, slot_date, slot_key);

alter table public.food_place_bets enable row level security;

drop policy if exists "food_place_bets_select_member" on public.food_place_bets;
create policy "food_place_bets_select_member" on public.food_place_bets
  for select to authenticated
  using (public.is_room_member(room_id) or public.is_admin());

drop policy if exists "food_place_bets_insert_own" on public.food_place_bets;
create policy "food_place_bets_insert_own" on public.food_place_bets
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_room_member(room_id));

alter publication supabase_realtime add table public.food_place_bets;
