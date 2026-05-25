"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { ChevronDown, Plus } from "lucide-react";

import {
  addFoodComment,
  castFoodVote,
  deleteFoodComment,
  deleteFoodProposal,
  removeFoodSlotPreference,
  setFoodSlotPreference,
} from "@/app/_actions/food";
import { FoodCard } from "@/components/food/food-card";
import { FoodForm } from "@/components/food/food-form";
import { FoodSlotCard } from "@/components/food/food-slot-card";
import { ProposalCalendarBar } from "@/components/proposals/proposal-calendar-bar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useFoodRealtime } from "@/hooks/use-food-realtime";
import { copy } from "@/lib/copy";
import type { MemberMap } from "@/lib/members";
import {
  rangeFor,
  shiftAnchor,
  type CalendarView,
} from "@/lib/proposals/calendar";
import { voteWeight } from "@/lib/proposals/joke";
import { pickWinnerId } from "@/lib/proposals/winner";
import { FOOD_SLOTS } from "@/lib/slots";
import { formatClock, formatDateLong, isoDatePlus } from "@/lib/time";
import type {
  FoodComment,
  FoodProposal,
  FoodVote,
  VoteValue,
} from "@/types/database";

function dateLabel(date: string): string {
  if (date === isoDatePlus(0)) return copy.proposals.today;
  if (date === isoDatePlus(1)) return copy.proposals.tomorrow;
  return formatDateLong(date);
}

function groupByDate(items: FoodProposal[]) {
  const sorted = [...items].sort(
    (a, b) =>
      a.food_date.localeCompare(b.food_date) ||
      a.created_at.localeCompare(b.created_at),
  );
  const byDate = new Map<string, FoodProposal[]>();
  for (const item of sorted) {
    byDate.set(item.food_date, [...(byDate.get(item.food_date) ?? []), item]);
  }
  return Array.from(byDate.entries()).map(([date, list]) => ({
    date,
    label: dateLabel(date),
    items: list,
  }));
}

interface FoodPanelProps {
  roomId: string;
  userId: string;
  members: MemberMap;
  initialProposals: FoodProposal[];
  initialVotes: FoodVote[];
  initialComments: FoodComment[];
}

export function FoodPanel({
  roomId,
  userId,
  members,
  initialProposals,
  initialVotes,
  initialComments,
}: FoodPanelProps) {
  const [proposals, setProposals] = useState(initialProposals);
  const [votes, setVotes] = useState(initialVotes);
  const [comments, setComments] = useState(initialComments);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<CalendarView>("week");
  const [anchor, setAnchor] = useState(() => isoDatePlus(0));
  const [showEarlier, setShowEarlier] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [, startTransition] = useTransition();

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  useFoodRealtime(roomId, {
    onProposalInsert: (p) =>
      setProposals((prev) =>
        prev.some((i) => i.id === p.id) ? prev : [...prev, p],
      ),
    onProposalUpdate: (p) =>
      setProposals((prev) => prev.map((i) => (i.id === p.id ? p : i))),
    onProposalDelete: (id) => {
      setProposals((prev) => prev.filter((i) => i.id !== id));
      setVotes((prev) => prev.filter((v) => v.food_proposal_id !== id));
    },
    onVoteUpsert: (vote) =>
      setVotes((prev) => [
        ...prev.filter(
          (v) =>
            !(
              v.food_proposal_id === vote.food_proposal_id &&
              v.user_id === vote.user_id
            ),
        ),
        vote,
      ]),
    onVoteDelete: (key) =>
      setVotes((prev) =>
        prev.filter(
          (v) =>
            !(
              v.food_proposal_id === key.food_proposal_id &&
              v.user_id === key.user_id
            ),
        ),
      ),
    onCommentInsert: (c) =>
      setComments((prev) =>
        prev.some((i) => i.id === c.id) ? prev : [...prev, c],
      ),
    onCommentDelete: (id) =>
      setComments((prev) => prev.filter((i) => i.id !== id)),
  });

  function handleVote(foodProposalId: string, value: VoteValue) {
    const snapshot = votes;
    setVotes((prev) => [
      ...prev.filter(
        (v) => !(v.food_proposal_id === foodProposalId && v.user_id === userId),
      ),
      {
        food_proposal_id: foodProposalId,
        user_id: userId,
        vote: value,
        voted_at: new Date().toISOString(),
      },
    ]);
    startTransition(async () => {
      const result = await castFoodVote({ foodProposalId, vote: value });
      if (!result.ok) {
        setVotes(snapshot);
        toast.error(result.error);
      }
    });
  }

  function handleDelete(id: string) {
    const snapshot = proposals;
    setProposals((prev) => prev.filter((i) => i.id !== id));
    startTransition(async () => {
      const result = await deleteFoodProposal(id);
      if (result.ok) toast.success(copy.food.deleted);
      else {
        setProposals(snapshot);
        toast.error(result.error);
      }
    });
  }

  function handleAddComment(foodProposalId: string, content: string) {
    const tempId = `temp-${crypto.randomUUID()}`;
    setComments((prev) => [
      ...prev,
      {
        id: tempId,
        food_proposal_id: foodProposalId,
        room_id: roomId,
        author_id: userId,
        content,
        created_at: new Date().toISOString(),
      },
    ]);
    startTransition(async () => {
      const result = await addFoodComment({ foodProposalId, content });
      setComments((prev) => {
        const withoutTemp = prev.filter((i) => i.id !== tempId);
        if (!result.ok) return withoutTemp;
        return withoutTemp.some((i) => i.id === result.comment.id)
          ? withoutTemp
          : [...withoutTemp, result.comment];
      });
      if (!result.ok) toast.error(result.error);
    });
  }

  function handleDeleteComment(commentId: string) {
    const snapshot = comments;
    setComments((prev) => prev.filter((i) => i.id !== commentId));
    startTransition(async () => {
      const result = await deleteFoodComment(commentId);
      if (!result.ok) {
        setComments(snapshot);
        toast.error(result.error);
      }
    });
  }

  function handleSetSlotPreference(
    slotKey: string,
    date: string,
    choice: string,
  ) {
    startTransition(async () => {
      const result = await setFoodSlotPreference({
        roomId,
        slotKey,
        date,
        choice,
      });
      if (result.ok) toast.success(copy.food.slots.saved);
      else toast.error(result.error);
    });
  }

  function handleClearSlotPreference(slotKey: string) {
    startTransition(async () => {
      const result = await removeFoodSlotPreference(roomId, anchor, slotKey);
      if (!result.ok) toast.error(result.error);
    });
  }

  const range = rangeFor(view, anchor);
  // Free-form food proposals only (slot choices render in the slot cards).
  const freeForm = proposals.filter((p) => !p.slot_key);
  const groups = groupByDate(
    freeForm.filter(
      (p) => p.food_date >= range.start && p.food_date <= range.end,
    ),
  );

  // Split fixed meal slots into upcoming and already-passed (today only).
  const todayIso = isoDatePlus(0);
  const nowClock = formatClock(now);
  const slotEntries = FOOD_SLOTS.map((slot) => {
    const suggestions = proposals.filter(
      (p) => p.slot_key === slot.key && p.food_date === anchor,
    );
    const passed =
      anchor < todayIso ||
      (anchor === todayIso && slot.defaultTime < nowClock);
    return { slot, suggestions, passed };
  });
  const upcomingSlots = slotEntries.filter((e) => !e.passed);
  const earlierSlots = slotEntries.filter((e) => e.passed);

  const renderSlot = (entry: (typeof slotEntries)[number]) => (
    <FoodSlotCard
      key={entry.slot.key}
      slot={entry.slot}
      date={anchor}
      suggestions={entry.suggestions}
      votes={votes}
      comments={comments}
      members={members}
      userId={userId}
      onSetPreference={handleSetSlotPreference}
      onClearPreference={handleClearSlotPreference}
      onVote={handleVote}
      onDelete={handleDelete}
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
        <h2 className="font-semibold">
          {copy.food.slots.title}{" "}
          <span className="font-normal text-muted-foreground capitalize">
            · {formatDateLong(anchor)}
          </span>
        </h2>
        <div className="space-y-3">{upcomingSlots.map(renderSlot)}</div>

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
                  showEarlier
                    ? "size-4 rotate-180 transition-transform"
                    : "size-4 transition-transform"
                }
              />
              {copy.food.slots.earlier} ({earlierSlots.length})
            </Button>
            {showEarlier && (
              <div className="space-y-3 opacity-80">
                {earlierSlots.map(renderSlot)}
              </div>
            )}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{copy.food.slots.free}</h2>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button size="sm" variant="outline" />}>
              <Plus />
              {copy.food.new}
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{copy.food.form.title}</DialogTitle>
              </DialogHeader>
              <FoodForm
                roomId={roomId}
                onCreated={(proposal) => {
                  setProposals((prev) =>
                    prev.some((i) => i.id === proposal.id)
                      ? prev
                      : [...prev, proposal],
                  );
                  setOpen(false);
                }}
              />
            </DialogContent>
          </Dialog>
        </div>

        {groups.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            {freeForm.length === 0
              ? copy.food.empty
              : copy.proposals.calendar.emptyRange}
          </p>
        ) : (
          <div className="space-y-5">
            {groups.map((group) => {
              const groupWinner = pickWinnerId(
                group.items.map((p) => p.id),
                (id) =>
                  votes
                    .filter(
                      (v) => v.food_proposal_id === id && v.vote === "yes",
                    )
                    .reduce(
                      (sum, v) =>
                        sum + voteWeight(members[v.user_id]?.name ?? ""),
                      0,
                    ),
              );
              return (
                <section key={group.date} className="space-y-2">
                  <h3 className="text-xs font-medium text-muted-foreground uppercase">
                    {group.label}
                  </h3>
                  <div className="space-y-3">
                    {group.items.map((proposal) => (
                      <FoodCard
                        key={proposal.id}
                        proposal={proposal}
                        votes={votes.filter(
                          (v) => v.food_proposal_id === proposal.id,
                        )}
                        comments={comments.filter(
                          (c) => c.food_proposal_id === proposal.id,
                        )}
                        members={members}
                        userId={userId}
                        canDelete={proposal.created_by === userId}
                        isWinner={proposal.id === groupWinner}
                        onVote={(value) => handleVote(proposal.id, value)}
                        onDelete={() => handleDelete(proposal.id)}
                        onAddComment={handleAddComment}
                        onDeleteComment={handleDeleteComment}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
