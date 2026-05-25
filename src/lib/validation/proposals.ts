import { z } from "zod";

import { copy } from "@/lib/copy";
import { isoDatePlus } from "@/lib/time";

export const PROPOSAL_TYPES = ["lunch", "dinner", "coffee", "other"] as const;
export const VOTE_VALUES = ["yes", "maybe", "no"] as const;
export const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120] as const;
export const MAX_DAYS_AHEAD = 7;

const QUARTER_HOUR = /^([01]\d|2[0-3]):(00|15|30|45)$/;

export const createProposalSchema = z
  .object({
    roomId: z.string().uuid(),
    proposalType: z.enum(PROPOSAL_TYPES),
    proposalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    startTime: z.string().regex(QUARTER_HOUR, copy.proposals.validation.timeQuarter),
    durationMinutes: z
      .number()
      .int()
      .refine(
        (value) => (DURATION_OPTIONS as readonly number[]).includes(value),
        copy.proposals.validation.durationInvalid,
      ),
    note: z.string().trim().max(200, copy.proposals.validation.noteTooLong).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.proposalDate < isoDatePlus(0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["proposalDate"],
        message: copy.proposals.validation.dateInPast,
      });
    }
    if (value.proposalDate > isoDatePlus(MAX_DAYS_AHEAD)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["proposalDate"],
        message: copy.proposals.validation.dateTooFar,
      });
    }
  });

export const castVoteSchema = z.object({
  proposalId: z.string().uuid(),
  vote: z.enum(VOTE_VALUES),
});

export const setSlotPreferenceSchema = z.object({
  roomId: z.string().uuid(),
  slotKey: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
});

export type CreateProposalInput = z.infer<typeof createProposalSchema>;
export type CastVoteInput = z.infer<typeof castVoteSchema>;
