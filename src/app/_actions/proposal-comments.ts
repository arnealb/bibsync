"use server";

import type { ActionResult } from "@/app/_actions/types";
import { copy } from "@/lib/copy";
import { createClient } from "@/lib/supabase/server";
import { addCommentSchema, type AddCommentInput } from "@/lib/validation/comments";
import type { ProposalComment } from "@/types/database";

export type AddCommentResult =
  | { ok: true; comment: ProposalComment }
  | { ok: false; error: string };

export async function addProposalComment(
  input: AddCommentInput,
): Promise<AddCommentResult> {
  const parsed = addCommentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: copy.proposals.comments.error };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: copy.common.notAuthenticated };

  // Derive room_id from the proposal (also enforces read access via RLS).
  const { data: proposal } = await supabase
    .from("break_proposals")
    .select("room_id")
    .eq("id", parsed.data.proposalId)
    .maybeSingle();
  if (!proposal) return { ok: false, error: copy.proposals.comments.error };

  const { data, error } = await supabase
    .from("proposal_comments")
    .insert({
      proposal_id: parsed.data.proposalId,
      room_id: proposal.room_id,
      author_id: user.id,
      content: parsed.data.content,
    })
    .select("*")
    .single();

  if (error || !data) {
    console.error("[addProposalComment]", error);
    return { ok: false, error: copy.proposals.comments.error };
  }

  return { ok: true, comment: data };
}

export async function deleteProposalComment(
  commentId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("proposal_comments")
    .delete()
    .eq("id", commentId);

  if (error) {
    console.error("[deleteProposalComment]", error);
    return { ok: false, error: copy.common.genericError };
  }

  return { ok: true };
}
