"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { ChevronDown, Plus } from "lucide-react";

import {
  addProposalComment,
  deleteProposalComment,
} from "@/app/_actions/proposal-comments";
import {
  castVote,
  deleteProposal,
  removeSlotPreference,
  setSlotPreference,
} from "@/app/_actions/proposals";
import { ProposalCalendarBar } from "@/components/proposals/proposal-calendar-bar";
import { ProposalCard } from "@/components/proposals/proposal-card";
import { ProposalForm } from "@/components/proposals/proposal-form";
import { SlotCard } from "@/components/proposals/slot-card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useProposalCommentsRealtime } from "@/hooks/use-proposal-comments-realtime";
import { useProposalsRealtime } from "@/hooks/use-proposals-realtime";
import { copy } from "@/lib/copy";
import type { MemberMap } from "@/lib/members";
import {
  rangeFor,
  shiftAnchor,
  type CalendarView,
} from "@/lib/proposals/calendar";
import { dateLabelGroups } from "@/lib/proposals/group";
import { voteWeight } from "@/lib/proposals/joke";
import { isProposalVisible } from "@/lib/proposals/visibility";
import { decideSlotTime, pickWinnerId } from "@/lib/proposals/winner";
import { BREAK_SLOTS } from "@/lib/slots";
import { formatClock, formatDateLong, isoDatePlus } from "@/lib/time";
import type {
  BreakProposal,
  ProposalComment,
  RoomPlace,
  Vote,
  VoteValue,
} from "@/types/database";

interface ProposalsPanelProps {
  roomId: string;
  userId: string;
  members: MemberMap;
  initialProposals: BreakProposal[];
  initialVotes: Vote[];
  initialComments: ProposalComment[];
  initialPlaces: RoomPlace[];
}

export function ProposalsPanel({
  roomId,
  userId,
  members,
  initialProposals,
  initialVotes,
  initialComments,
  initialPlaces,
}: ProposalsPanelProps) {
  const [proposals, setProposals] = useState(initialProposals);
  const [votes, setVotes] = useState(initialVotes);
  const [comments, setComments] = useState(initialComments);
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [view, setView] = useState<CalendarView>("day");
  const [anchor, setAnchor] = useState(() => isoDatePlus(0));
  const [showEarlier, setShowEarlier] = useState(false);
  const [, startTransition] = useTransition();

  // Re-evaluate visibility every minute so expired proposals drop off on their
  // own (one hour after they end) without needing a refresh.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  useProposalsRealtime(roomId, {
    onProposalInsert: (proposal) =>
      setProposals((prev) =>
        prev.some((item) => item.id === proposal.id)
          ? prev
          : [...prev, proposal],
      ),
    onProposalUpdate: (proposal) =>
      setProposals((prev) =>
        prev.map((item) => (item.id === proposal.id ? proposal : item)),
      ),
    onProposalDelete: (id) => {
      setProposals((prev) => prev.filter((item) => item.id !== id));
      setVotes((prev) => prev.filter((vote) => vote.proposal_id !== id));
    },
    onVoteUpsert: (vote) =>
      setVotes((prev) => [
        ...prev.filter(
          (item) =>
            !(
              item.proposal_id === vote.proposal_id &&
              item.user_id === vote.user_id
            ),
        ),
        vote,
      ]),
    onVoteDelete: (key) =>
      setVotes((prev) =>
        prev.filter(
          (vote) =>
            !(
              vote.proposal_id === key.proposal_id &&
              vote.user_id === key.user_id
            ),
        ),
      ),
  });

  useProposalCommentsRealtime(roomId, {
    onInsert: (comment) =>
      setComments((prev) =>
        prev.some((item) => item.id === comment.id)
          ? prev
          : [...prev, comment],
      ),
    onDelete: (id) =>
      setComments((prev) => prev.filter((item) => item.id !== id)),
  });

  function handleVote(proposalId: string, value: VoteValue) {
    const snapshot = votes;
    setVotes((prev) => [
      ...prev.filter(
        (vote) =>
          !(vote.proposal_id === proposalId && vote.user_id === userId),
      ),
      {
        proposal_id: proposalId,
        user_id: userId,
        vote: value,
        voted_at: new Date().toISOString(),
      },
    ]);
    startTransition(async () => {
      const result = await castVote({ proposalId, vote: value });
      if (!result.ok) {
        setVotes(snapshot);
        toast.error(result.error);
      }
    });
  }

  function handleDelete(id: string) {
    const snapshot = proposals;
    setProposals((prev) => prev.filter((item) => item.id !== id));
    startTransition(async () => {
      const result = await deleteProposal(id);
      if (result.ok) toast.success(copy.proposals.deleted);
      else {
        setProposals(snapshot);
        toast.error(result.error);
      }
    });
  }

  function handleAddComment(proposalId: string, content: string) {
    const tempId = `temp-${crypto.randomUUID()}`;
    setComments((prev) => [
      ...prev,
      {
        id: tempId,
        proposal_id: proposalId,
        room_id: roomId,
        author_id: userId,
        content,
        created_at: new Date().toISOString(),
      },
    ]);
    startTransition(async () => {
      const result = await addProposalComment({ proposalId, content });
      setComments((prev) => {
        const withoutTemp = prev.filter((item) => item.id !== tempId);
        if (!result.ok) return withoutTemp;
        return withoutTemp.some((item) => item.id === result.comment.id)
          ? withoutTemp
          : [...withoutTemp, result.comment];
      });
      if (!result.ok) toast.error(result.error);
    });
  }

  function handleDeleteComment(commentId: string) {
    const snapshot = comments;
    setComments((prev) => prev.filter((item) => item.id !== commentId));
    startTransition(async () => {
      const result = await deleteProposalComment(commentId);
      if (!result.ok) {
        setComments(snapshot);
        toast.error(result.error);
      }
    });
  }

  function handleSetSlotPreference(
    slotKey: string,
    date: string,
    time: string,
    destination?: string,
    isWalk?: boolean,
    routePoints?: { lat: number; lng: number }[],
  ) {
    startTransition(async () => {
      const result = await setSlotPreference({
        roomId,
        slotKey,
        date,
        time,
        destination,
        isWalk,
        routePoints,
      });
      if (result.ok) toast.success(copy.proposals.slots.saved);
      else toast.error(result.error);
    });
  }

  function handleClearSlotPreference(slotKey: string) {
    startTransition(async () => {
      const result = await removeSlotPreference(roomId, anchor, slotKey);
      if (!result.ok) toast.error(result.error);
    });
  }

  const range = rangeFor(view, anchor);
  const freeForm = proposals.filter(
    (p) => !p.slot_key && isProposalVisible(p, now),
  );

  // Fixed slots for the anchor day, each with the decided time it'll happen.
  const todayIso = isoDatePlus(0);
  const nowClock = formatClock(now);
  const slotEntries = BREAK_SLOTS.map((slot) => {
    const suggestions = proposals.filter(
      (p) => p.slot_key === slot.key && p.proposal_date === anchor,
    );
    const effective =
      decideSlotTime(suggestions, votes, (uid) =>
        voteWeight(members[uid]?.name ?? ""),
      ) ?? slot.defaultTime.slice(0, 5);
    const passed =
      anchor < todayIso || (anchor === todayIso && effective < nowClock);
    return { slot, suggestions, passed, effective };
  });
  const earlierSlots = slotEntries.filter((e) => e.passed);

  // Free proposals on the anchor day are interleaved into the day's timeline at
  // their own time (so they aren't missed in a separate section); free
  // proposals on other days in the range get their own list below.
  const yesWeight = (id: string) =>
    votes
      .filter((v) => v.proposal_id === id && v.vote === "yes")
      .reduce((sum, v) => sum + voteWeight(members[v.user_id]?.name ?? ""), 0);
  const anchorFree = freeForm.filter((p) => p.proposal_date === anchor);
  const freeWinner = pickWinnerId(anchorFree.map((p) => p.id), yesWeight);
  const otherGroups = dateLabelGroups(
    freeForm.filter(
      (p) =>
        p.proposal_date !== anchor &&
        p.proposal_date >= range.start &&
        p.proposal_date <= range.end,
    ),
  );

  type TimelineItem =
    | { kind: "slot"; time: string; entry: (typeof slotEntries)[number] }
    | { kind: "free"; time: string; proposal: BreakProposal };
  const timeline: TimelineItem[] = [
    ...slotEntries
      .filter((e) => !e.passed)
      .map((entry) => ({ kind: "slot" as const, time: entry.effective, entry })),
    ...anchorFree.map((proposal) => ({
      kind: "free" as const,
      time: proposal.start_time.slice(0, 5),
      proposal,
    })),
  ].sort((a, b) => a.time.localeCompare(b.time));

  const renderSlot = (entry: (typeof slotEntries)[number]) => (
    <SlotCard
      key={entry.slot.key}
      slot={entry.slot}
      date={anchor}
      suggestions={entry.suggestions}
      votes={votes}
      comments={comments}
      members={members}
      userId={userId}
      places={initialPlaces}
      onSetPreference={handleSetSlotPreference}
      onClearPreference={handleClearSlotPreference}
      onVote={handleVote}
      onDelete={handleDelete}
      onAddComment={handleAddComment}
      onDeleteComment={handleDeleteComment}
    />
  );

  const renderFree = (proposal: BreakProposal, winnerId: string | null) => (
    <ProposalCard
      key={proposal.id}
      proposal={proposal}
      votes={votes.filter((v) => v.proposal_id === proposal.id)}
      comments={comments.filter((c) => c.proposal_id === proposal.id)}
      members={members}
      userId={userId}
      canDelete={proposal.created_by === userId}
      isWinner={proposal.id === winnerId}
      freeProposal
      onVote={(value) => handleVote(proposal.id, value)}
      onDelete={() => handleDelete(proposal.id)}
      onAddComment={handleAddComment}
      onDeleteComment={handleDeleteComment}
    />
  );

  return (
    <div className="space-y-6">
      <ProposalCalendarBar
        view={view}
        anchor={anchor}
        onView={setView}
        onShift={(dir) => setAnchor((a) => shiftAnchor(view, a, dir))}
        onToday={() => setAnchor(isoDatePlus(0))}
      />

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">
            {copy.proposals.slots.title}{" "}
            <span className="font-normal text-muted-foreground capitalize">
              · {formatDateLong(anchor)}
            </span>
          </h2>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button size="sm" variant="outline" />}>
              <Plus />
              {copy.proposals.new}
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{copy.proposals.form.title}</DialogTitle>
              </DialogHeader>
              <ProposalForm
                roomId={roomId}
                places={initialPlaces}
                onCreated={(proposal) => {
                  setProposals((prev) =>
                    prev.some((item) => item.id === proposal.id)
                      ? prev
                      : [...prev, proposal],
                  );
                  setOpen(false);
                }}
              />
            </DialogContent>
          </Dialog>
        </div>

        {/* Fixed slots and the day's free proposals, interleaved by time. */}
        <div className="space-y-3">
          {timeline.map((item) =>
            item.kind === "slot"
              ? renderSlot(item.entry)
              : renderFree(item.proposal, freeWinner),
          )}
        </div>

        {earlierSlots.length > 0 && (
          <div className="space-y-3">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              aria-expanded={showEarlier}
              onClick={() => setShowEarlier((v) => !v)}
            >
              <ChevronDown
                className={
                  showEarlier ? "size-4 rotate-180 transition-transform" : "size-4 transition-transform"
                }
              />
              {copy.proposals.slots.earlier} ({earlierSlots.length})
            </Button>
            {showEarlier && (
              <div className="space-y-3 opacity-80">
                {earlierSlots.map(renderSlot)}
              </div>
            )}
          </div>
        )}
      </section>

      {otherGroups.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-semibold">{copy.proposals.slots.otherDays}</h2>
          <div className="space-y-5">
            {otherGroups.map((group) => {
              const groupWinner = pickWinnerId(
                group.items.map((p) => p.id),
                yesWeight,
              );
              return (
                <section key={group.date} className="space-y-2">
                  <h3 className="text-xs font-medium text-muted-foreground uppercase">
                    {group.label}
                  </h3>
                  <div className="space-y-3">
                    {group.items.map((proposal) =>
                      renderFree(proposal, groupWinner),
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
