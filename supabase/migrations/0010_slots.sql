-- ============================================================================
-- BibSync — fixed daily slots
-- A `slot_key` tags a proposal/food proposal as belonging to a fixed daily slot
-- (e.g. 'ochtendpauze'). NULL = a free-form proposal (the old behaviour).
-- ============================================================================

alter table public.break_proposals add column if not exists slot_key text;
alter table public.food_proposals  add column if not exists slot_key text;

create index if not exists break_proposals_slot_idx
  on public.break_proposals (room_id, proposal_date, slot_key);
create index if not exists food_proposals_slot_idx
  on public.food_proposals (room_id, food_date, slot_key);
