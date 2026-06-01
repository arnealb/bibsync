-- ============================================================================
-- BibSync — "Stelen" (theft) with a bluff/catch dynamic.
--
-- A member steals X from another member (X moves immediately). The victim can
-- claim "ik ben bestolen" until their *next spend* (checked against the ledger,
-- not stored) — claim in time and the thief pays back 2X; too late and the
-- thief keeps it. Claiming when you weren't robbed costs a flat penalty that
-- goes to the casino fund (so the BIB-aandeel rises).
--
-- Coin movement runs in the theft action via award_/spend_bibcoins; this
-- migration stores theft records and folds the false-claim penalty into the
-- casino's house profit.
-- ============================================================================

create table if not exists public.thefts (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null references public.rooms(id) on delete cascade,
  thief_id    uuid not null references public.profiles(id) on delete cascade,
  victim_id   uuid not null references public.profiles(id) on delete cascade,
  amount      integer not null check (amount > 0),
  -- pending → claimable; claimed → victim caught the thief; locked → expired.
  status      text not null default 'pending'
                check (status in ('pending', 'claimed', 'locked')),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists thefts_victim_idx
  on public.thefts (victim_id, status);
create index if not exists thefts_thief_idx
  on public.thefts (thief_id, created_at);

-- At most one open theft per (thief, victim) pair — no stacking/spam.
create unique index if not exists thefts_one_pending_per_pair
  on public.thefts (thief_id, victim_id)
  where status = 'pending';

alter table public.thefts enable row level security;

-- Victim and thief may read their own theft rows; only the service role writes.
drop policy if exists thefts_select_own on public.thefts;
create policy thefts_select_own on public.thefts
  for select to authenticated
  using (victim_id = auth.uid() or thief_id = auth.uid());

-- Realtime so the victim is notified the moment they're robbed.
alter publication supabase_realtime add table public.thefts;

-- ----------------------------------------------------------------------------
-- Redefine casino_stats() to also count the false-claim penalty as house
-- profit (it isn't a wager, so it's excluded from "wagered"). Supersedes the
-- definition in 0050. MIRROR of CASINO_*_REASONS in src/lib/stock/config.ts +
-- 'theft_false_claim'.
-- ----------------------------------------------------------------------------
create or replace function public.casino_stats()
returns table(net bigint, wagered bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    -coalesce(sum(amount), 0)::bigint as net,
    -coalesce(sum(amount) filter (where reason in (
      'dice_bet','wheel_bet','hilo_bet','keno_bet','plinko_bet','mines_bet',
      'blackjack_bet','roulette_bet','crash_bet'
    )), 0)::bigint as wagered
  from public.bibcoin_transactions
  where reason in (
    'dice_bet','wheel_bet','hilo_bet','keno_bet','plinko_bet','mines_bet',
    'blackjack_bet','roulette_bet','crash_bet',
    'dice_payout','wheel_payout','hilo_payout','keno_payout','plinko_payout',
    'mines_payout','blackjack_payout','blackjack_win','roulette_payout',
    'roulette_win','crash_payout',
    'hilo_refund','mines_refund','blackjack_refund','roulette_refund',
    'crash_refund',
    'theft_false_claim'
  );
$$;

revoke execute on function public.casino_stats() from public, authenticated;
grant execute on function public.casino_stats() to service_role;
