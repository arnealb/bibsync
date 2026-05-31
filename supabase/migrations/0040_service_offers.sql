-- ============================================================================
-- BibSync — bibcoin "klussenmarkt". Two directions:
--   * kind = 'offer'   — the author offers a service at a price; a buyer hires
--                        it and pays the author (buyer → author).
--   * kind = 'request' — the author needs something done for a budget; others
--                        place bids, the author accepts one and pays that
--                        bidder the bid price (author → bidder).
-- status: open → hired → done. Cancel = delete while open.
-- Payment always moves via the atomic transfer_bibcoins RPC (pay on hire/accept).
-- Hire/accept/complete/cancel run through the service role so the payment and
-- the status flip stay atomic; SELECT/INSERT (and own-bid edits) use RLS.
-- ============================================================================

create table if not exists public.service_offers (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid not null references public.rooms(id) on delete cascade,
  author_id    uuid not null references public.profiles(id) on delete cascade,
  kind         text not null default 'offer',
  title        text not null,
  description  text not null default '',
  price        integer not null,
  status       text not null default 'open',
  hired_by     uuid references public.profiles(id) on delete set null,
  agreed_price integer,
  created_at   timestamptz not null default now(),
  hired_at     timestamptz,
  completed_at timestamptz
);

create index if not exists service_offers_room_idx
  on public.service_offers (room_id, created_at desc);

alter table public.service_offers enable row level security;

drop policy if exists "service_offers_select_member" on public.service_offers;
create policy "service_offers_select_member" on public.service_offers
  for select to authenticated
  using (public.is_room_member(room_id) or public.is_admin());

drop policy if exists "service_offers_insert_own" on public.service_offers;
create policy "service_offers_insert_own" on public.service_offers
  for insert to authenticated
  with check (author_id = auth.uid() and public.is_room_member(room_id));

-- Bids on 'request' offers. room_id is denormalised for the realtime filter.
create table if not exists public.service_bids (
  id         uuid primary key default gen_random_uuid(),
  offer_id   uuid not null references public.service_offers(id) on delete cascade,
  room_id    uuid not null references public.rooms(id) on delete cascade,
  bidder_id  uuid not null references public.profiles(id) on delete cascade,
  price      integer not null,
  created_at timestamptz not null default now(),
  unique (offer_id, bidder_id)
);

create index if not exists service_bids_offer_idx
  on public.service_bids (offer_id);

alter table public.service_bids enable row level security;

drop policy if exists "service_bids_select_member" on public.service_bids;
create policy "service_bids_select_member" on public.service_bids
  for select to authenticated
  using (public.is_room_member(room_id) or public.is_admin());

drop policy if exists "service_bids_insert_own" on public.service_bids;
create policy "service_bids_insert_own" on public.service_bids
  for insert to authenticated
  with check (bidder_id = auth.uid() and public.is_room_member(room_id));

drop policy if exists "service_bids_update_own" on public.service_bids;
create policy "service_bids_update_own" on public.service_bids
  for update to authenticated
  using (bidder_id = auth.uid())
  with check (bidder_id = auth.uid());

drop policy if exists "service_bids_delete_own" on public.service_bids;
create policy "service_bids_delete_own" on public.service_bids
  for delete to authenticated
  using (bidder_id = auth.uid());

-- Realtime + full row so UPDATE/DELETE events carry the filter columns.
alter table public.service_offers replica identity full;
alter table public.service_bids replica identity full;
alter publication supabase_realtime add table public.service_offers;
alter publication supabase_realtime add table public.service_bids;
