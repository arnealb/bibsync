-- ============================================================================
-- BibSync — single-player Blackjack vs the dealer, staked in bibcoins.
--
-- One row per user holds the full game state, INCLUDING the remaining deck and
-- the dealer's hole card. That must never reach the client, so the table has
-- RLS enabled with no policies: only the service role (server actions) can
-- touch it, and actions return a masked public view.
-- ============================================================================

create table if not exists public.blackjack_games (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  state      jsonb not null,
  version    integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.blackjack_games enable row level security;
-- (deliberately no policies — service-role access only)
