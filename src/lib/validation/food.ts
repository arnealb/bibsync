import { z } from "zod";

import { copy } from "@/lib/copy";
import { isoDatePlus } from "@/lib/time";
import { MAX_DAYS_AHEAD, VOTE_VALUES } from "@/lib/validation/proposals";

export const createFoodProposalSchema = z
  .object({
    roomId: z.string().uuid(),
    choice: z
      .string()
      .trim()
      .min(1, copy.food.validation.choiceRequired)
      .max(60, copy.food.validation.choiceTooLong),
    foodDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    note: z.string().trim().max(200).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.foodDate < isoDatePlus(0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["foodDate"],
        message: copy.proposals.validation.dateInPast,
      });
    }
    if (value.foodDate > isoDatePlus(MAX_DAYS_AHEAD)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["foodDate"],
        message: copy.proposals.validation.dateTooFar,
      });
    }
  });

export const castFoodVoteSchema = z.object({
  foodProposalId: z.string().uuid(),
  vote: z.enum(VOTE_VALUES),
});

export const addFoodCommentSchema = z.object({
  foodProposalId: z.string().uuid(),
  content: z.string().trim().min(1).max(500),
});

export type CreateFoodProposalInput = z.infer<typeof createFoodProposalSchema>;
export type CastFoodVoteInput = z.infer<typeof castFoodVoteSchema>;
export type AddFoodCommentInput = z.infer<typeof addFoodCommentSchema>;
