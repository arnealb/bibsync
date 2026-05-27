-- ============================================================================
-- BibSync — forbid duplicate break proposals with the same config (ALL types,
-- not just dinner).
--   * free proposals: at most one per (room, date, start_time, type)
--   * slot preferences: at most one per (room, date, slot, user)
-- First de-duplicate existing rows (keep the most-voted, then earliest), then
-- add the partial unique indexes that make duplicates impossible going forward.
-- ============================================================================

-- Free-form duplicates (slot_key is null): keep one per room/date/time/type.
delete from public.break_proposals p
using (
  select bp.id,
    row_number() over (
      partition by
        bp.room_id, bp.proposal_date, bp.start_time, bp.proposal_type
      order by
        (select count(*) from public.votes v where v.proposal_id = bp.id) desc,
        bp.created_at asc,
        bp.id asc
    ) as rn
  from public.break_proposals bp
  where bp.slot_key is null
) d
where p.id = d.id and d.rn > 1;

-- Slot-preference duplicates: keep one per room/date/slot/user.
delete from public.break_proposals p
using (
  select bp.id,
    row_number() over (
      partition by bp.room_id, bp.proposal_date, bp.slot_key, bp.created_by
      order by
        (select count(*) from public.votes v where v.proposal_id = bp.id) desc,
        bp.created_at asc,
        bp.id asc
    ) as rn
  from public.break_proposals bp
  where bp.slot_key is not null
) d
where p.id = d.id and d.rn > 1;

create unique index if not exists break_proposals_free_unique
  on public.break_proposals (room_id, proposal_date, start_time, proposal_type)
  where slot_key is null;

create unique index if not exists break_proposals_slot_user_unique
  on public.break_proposals (room_id, proposal_date, slot_key, created_by)
  where slot_key is not null;
