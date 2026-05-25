import { describe, expect, it } from "vitest";

import { isProposalVisible } from "@/lib/proposals/visibility";
import type { BreakProposal } from "@/types/database";

const NOW = new Date("2026-05-25T12:00:00+02:00").getTime(); // Brussels noon

function proposal(
  date: string,
  start: string,
  duration: number,
): BreakProposal {
  return {
    proposal_date: date,
    start_time: start,
    duration_minutes: duration,
  } as unknown as BreakProposal;
}

describe("isProposalVisible", () => {
  it("hides proposals more than an hour after they ended", () => {
    // ends 09:30, +1h grace = 10:30, which is before 12:00
    expect(isProposalVisible(proposal("2026-05-25", "09:00", 30), NOW)).toBe(
      false,
    );
  });

  it("keeps proposals that are still upcoming or within the grace window", () => {
    expect(isProposalVisible(proposal("2026-05-25", "13:00", 30), NOW)).toBe(
      true,
    );
    // ended 11:30, +1h grace = 12:30, still visible at 12:00
    expect(isProposalVisible(proposal("2026-05-25", "11:00", 30), NOW)).toBe(
      true,
    );
  });

  it("hides yesterday and keeps tomorrow", () => {
    expect(isProposalVisible(proposal("2026-05-24", "23:00", 30), NOW)).toBe(
      false,
    );
    expect(isProposalVisible(proposal("2026-05-26", "09:00", 30), NOW)).toBe(
      true,
    );
  });
});
