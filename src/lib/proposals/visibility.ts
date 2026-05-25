import { proposalEndsAt } from "@/lib/time";
import type { BreakProposal } from "@/types/database";

/** A proposal stays visible until one hour after it has ended. */
export const VISIBILITY_GRACE_MS = 60 * 60 * 1000;

export function isProposalVisible(
  proposal: BreakProposal,
  now: number = Date.now(),
): boolean {
  const ends = proposalEndsAt(
    proposal.proposal_date,
    proposal.start_time,
    proposal.duration_minutes,
  );
  return now < ends + VISIBILITY_GRACE_MS;
}
