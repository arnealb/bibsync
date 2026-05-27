import type { Vote, VoteValue } from "@/types/database";

/**
 * Vote tally counted over the members who are actually present at the room
 * (location-confirmed). The denominator is the present headcount, so a card
 * reads e.g. "3/5 ok · 2/5 niet ok" — only people who are really there count.
 */
export interface PresentTally {
  total: number;
  counts: Record<VoteValue, number>;
}

export function presentTally(
  votes: Vote[],
  presentIds: Set<string>,
): PresentTally {
  const counts: Record<VoteValue, number> = { yes: 0, maybe: 0, no: 0 };
  for (const vote of votes) {
    if (presentIds.has(vote.user_id)) counts[vote.vote] += 1;
  }
  return { total: presentIds.size, counts };
}
