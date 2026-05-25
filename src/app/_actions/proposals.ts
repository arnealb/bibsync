"use server";

import type { ActionResult } from "@/app/_actions/types";
import { copy } from "@/lib/copy";
import { createClient } from "@/lib/supabase/server";
import {
  castVoteSchema,
  createProposalSchema,
  type CastVoteInput,
  type CreateProposalInput,
} from "@/lib/validation/proposals";
import type { BreakProposal } from "@/types/database";

export type CreateProposalResult =
  | { ok: true; proposal: BreakProposal }
  | { ok: false; error: string };

export async function createProposal(
  input: CreateProposalInput,
): Promise<CreateProposalResult> {
  const parsed = createProposalSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? copy.common.genericError,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: copy.common.notAuthenticated };

  const { data, error } = await supabase
    .from("break_proposals")
    .insert({
      room_id: parsed.data.roomId,
      created_by: user.id,
      proposal_type: parsed.data.proposalType,
      proposal_date: parsed.data.proposalDate,
      start_time: parsed.data.startTime,
      duration_minutes: parsed.data.durationMinutes,
      note: parsed.data.note ?? null,
    })
    .select("*")
    .single();

  if (error || !data) {
    console.error("[createProposal]", error);
    return { ok: false, error: copy.common.genericError };
  }

  return { ok: true, proposal: data };
}

export async function castVote(input: CastVoteInput): Promise<ActionResult> {
  const parsed = castVoteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: copy.proposals.votes.error };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: copy.common.notAuthenticated };

  const { error } = await supabase.from("votes").upsert(
    {
      proposal_id: parsed.data.proposalId,
      user_id: user.id,
      vote: parsed.data.vote,
    },
    { onConflict: "proposal_id,user_id" },
  );

  if (error) {
    console.error("[castVote]", error);
    return { ok: false, error: copy.proposals.votes.error };
  }

  return { ok: true };
}

export async function deleteProposal(
  proposalId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("break_proposals")
    .delete()
    .eq("id", proposalId);

  if (error) {
    console.error("[deleteProposal]", error);
    return { ok: false, error: copy.common.genericError };
  }

  return { ok: true };
}
