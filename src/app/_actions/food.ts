"use server";

import type { ActionResult } from "@/app/_actions/types";
import { copy } from "@/lib/copy";
import { sendRoomPush, sendUserPush } from "@/lib/push/send";
import { createClient } from "@/lib/supabase/server";
import { formatTime } from "@/lib/time";
import {
  addFoodCommentSchema,
  castFoodVoteSchema,
  createFoodProposalSchema,
  type AddFoodCommentInput,
  type CastFoodVoteInput,
  type CreateFoodProposalInput,
} from "@/lib/validation/food";
import type { FoodComment, FoodProposal } from "@/types/database";

export type CreateFoodResult =
  | { ok: true; proposal: FoodProposal }
  | { ok: false; error: string };

export type AddFoodCommentResult =
  | { ok: true; comment: FoodComment }
  | { ok: false; error: string };

async function userId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function createFoodProposal(
  input: CreateFoodProposalInput,
): Promise<CreateFoodResult> {
  const parsed = createFoodProposalSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? copy.common.genericError,
    };
  }

  const supabase = await createClient();
  const uid = await userId();
  if (!uid) return { ok: false, error: copy.common.notAuthenticated };

  const { data, error } = await supabase
    .from("food_proposals")
    .insert({
      room_id: parsed.data.roomId,
      created_by: uid,
      food_date: parsed.data.foodDate,
      food_time: parsed.data.foodTime,
      choice: parsed.data.choice,
      note: parsed.data.note ?? null,
    })
    .select("*")
    .single();

  if (error || !data) {
    console.error("[createFoodProposal]", error);
    return { ok: false, error: copy.common.genericError };
  }

  await sendRoomPush(parsed.data.roomId, "food", {
    title: copy.push.newFood,
    body: `${parsed.data.choice} om ${formatTime(parsed.data.foodTime)}`,
    url: `/app/rooms/${parsed.data.roomId}/eten`,
    tag: `food-${data.id}`,
  });

  return { ok: true, proposal: data };
}

export async function castFoodVote(
  input: CastFoodVoteInput,
): Promise<ActionResult> {
  const parsed = castFoodVoteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: copy.proposals.votes.error };

  const supabase = await createClient();
  const uid = await userId();
  if (!uid) return { ok: false, error: copy.common.notAuthenticated };

  const { error } = await supabase.from("food_votes").upsert(
    {
      food_proposal_id: parsed.data.foodProposalId,
      user_id: uid,
      vote: parsed.data.vote,
    },
    { onConflict: "food_proposal_id,user_id" },
  );
  if (error) {
    console.error("[castFoodVote]", error);
    return { ok: false, error: copy.proposals.votes.error };
  }

  const { data: proposal } = await supabase
    .from("food_proposals")
    .select("room_id, created_by")
    .eq("id", parsed.data.foodProposalId)
    .maybeSingle();
  if (proposal) {
    const emoji = { yes: "👍", maybe: "🤔", no: "👎" }[parsed.data.vote];
    await sendUserPush(proposal.created_by, "votes", {
      title: copy.push.newVote,
      body: `${emoji} ${copy.proposals.votes[parsed.data.vote]}`,
      url: `/app/rooms/${proposal.room_id}/eten`,
      tag: `food-vote-${parsed.data.foodProposalId}`,
    });
  }

  return { ok: true };
}

export async function deleteFoodProposal(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("food_proposals").delete().eq("id", id);
  if (error) {
    console.error("[deleteFoodProposal]", error);
    return { ok: false, error: copy.common.genericError };
  }
  return { ok: true };
}

export async function addFoodComment(
  input: AddFoodCommentInput,
): Promise<AddFoodCommentResult> {
  const parsed = addFoodCommentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: copy.proposals.comments.error };

  const supabase = await createClient();
  const uid = await userId();
  if (!uid) return { ok: false, error: copy.common.notAuthenticated };

  const { data: proposal } = await supabase
    .from("food_proposals")
    .select("room_id, created_by")
    .eq("id", parsed.data.foodProposalId)
    .maybeSingle();
  if (!proposal) return { ok: false, error: copy.proposals.comments.error };

  const { data, error } = await supabase
    .from("food_comments")
    .insert({
      food_proposal_id: parsed.data.foodProposalId,
      room_id: proposal.room_id,
      author_id: uid,
      content: parsed.data.content,
    })
    .select("*")
    .single();

  if (error || !data) {
    console.error("[addFoodComment]", error);
    return { ok: false, error: copy.proposals.comments.error };
  }

  await sendUserPush(proposal.created_by, "comments", {
    title: copy.push.newComment,
    body: parsed.data.content.slice(0, 120),
    url: `/app/rooms/${proposal.room_id}/eten`,
    tag: `food-comment-${parsed.data.foodProposalId}`,
  });

  return { ok: true, comment: data };
}

export async function deleteFoodComment(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("food_comments").delete().eq("id", id);
  if (error) {
    console.error("[deleteFoodComment]", error);
    return { ok: false, error: copy.common.genericError };
  }
  return { ok: true };
}
