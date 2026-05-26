"use server";

import type { ActionResult } from "@/app/_actions/types";
import { earnFromVote } from "@/lib/bibcoins/earn";
import { copy } from "@/lib/copy";
import { sendRoomPush, sendUserPush } from "@/lib/push/send";
import { BREAK_SLOTS } from "@/lib/slots";
import { createClient } from "@/lib/supabase/server";
import { formatTime } from "@/lib/time";
import {
  castVoteSchema,
  createProposalSchema,
  setSlotPreferenceSchema,
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

  // One free-form proposal per time slot: reject a clash on date + start time
  // (slot suggestions are exempt — multiple people may prefer the same time).
  const { data: clash } = await supabase
    .from("break_proposals")
    .select("id")
    .eq("room_id", parsed.data.roomId)
    .eq("proposal_date", parsed.data.proposalDate)
    .eq("start_time", parsed.data.startTime)
    .is("slot_key", null)
    .limit(1);
  if (clash && clash.length > 0) {
    return { ok: false, error: copy.proposals.validation.slotTaken };
  }

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

  await sendRoomPush(parsed.data.roomId, "proposals", {
    title: copy.push.newProposal,
    body: `${copy.proposals.types[parsed.data.proposalType]} om ${formatTime(
      parsed.data.startTime,
    )}`,
    url: `/app/rooms/${parsed.data.roomId}`,
    tag: `proposal-${data.id}`,
  });

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

  const { data: proposal } = await supabase
    .from("break_proposals")
    .select("room_id, created_by")
    .eq("id", parsed.data.proposalId)
    .maybeSingle();
  if (proposal) {
    const emoji = { yes: "👍", maybe: "🤔", no: "👎" }[parsed.data.vote];
    await sendUserPush(proposal.created_by, "votes", {
      title: copy.push.newVote,
      body: `${emoji} ${copy.proposals.votes[parsed.data.vote]}`,
      url: `/app/rooms/${proposal.room_id}`,
      tag: `vote-${parsed.data.proposalId}`,
    });
  }

  await earnFromVote(user.id, parsed.data.proposalId);
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

/** Sets the caller's preferred time for a fixed slot (one per user/slot/day). */
export async function setSlotPreference(input: {
  roomId: string;
  slotKey: string;
  date: string;
  time: string;
}): Promise<ActionResult> {
  const parsed = setSlotPreferenceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: copy.common.genericError };
  const slot = BREAK_SLOTS.find((s) => s.key === parsed.data.slotKey);
  if (!slot) return { ok: false, error: copy.common.genericError };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: copy.common.notAuthenticated };

  // Replace any existing preference of this user for this slot + day.
  await supabase
    .from("break_proposals")
    .delete()
    .eq("room_id", parsed.data.roomId)
    .eq("proposal_date", parsed.data.date)
    .eq("created_by", user.id)
    .eq("slot_key", slot.key);

  const { error } = await supabase.from("break_proposals").insert({
    room_id: parsed.data.roomId,
    created_by: user.id,
    proposal_type: slot.type,
    proposal_date: parsed.data.date,
    start_time: parsed.data.time,
    duration_minutes: 30,
    slot_key: slot.key,
  });
  if (error) {
    console.error("[setSlotPreference]", error);
    return { ok: false, error: copy.common.genericError };
  }
  return { ok: true };
}

export async function removeSlotPreference(
  roomId: string,
  date: string,
  slotKey: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: copy.common.notAuthenticated };

  const { error } = await supabase
    .from("break_proposals")
    .delete()
    .eq("room_id", roomId)
    .eq("proposal_date", date)
    .eq("created_by", user.id)
    .eq("slot_key", slotKey);
  if (error) {
    console.error("[removeSlotPreference]", error);
    return { ok: false, error: copy.common.genericError };
  }
  return { ok: true };
}
