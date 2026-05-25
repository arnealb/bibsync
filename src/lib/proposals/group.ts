import { copy } from "@/lib/copy";
import { formatDateLong, isoDatePlus } from "@/lib/time";
import type { BreakProposal } from "@/types/database";

export interface ProposalGroup {
  date: string;
  label: string;
  items: BreakProposal[];
}

function labelFor(date: string): string {
  if (date === isoDatePlus(0)) return copy.proposals.today;
  if (date === isoDatePlus(1)) return copy.proposals.tomorrow;
  return formatDateLong(date);
}

/** Groups proposals by date (today first), each sorted by start time. */
export function dateLabelGroups(proposals: BreakProposal[]): ProposalGroup[] {
  const sorted = [...proposals].sort(
    (a, b) =>
      a.proposal_date.localeCompare(b.proposal_date) ||
      a.start_time.localeCompare(b.start_time),
  );

  const byDate = new Map<string, BreakProposal[]>();
  for (const proposal of sorted) {
    const list = byDate.get(proposal.proposal_date) ?? [];
    byDate.set(proposal.proposal_date, [...list, proposal]);
  }

  return Array.from(byDate.entries()).map(([date, items]) => ({
    date,
    label: labelFor(date),
    items,
  }));
}
