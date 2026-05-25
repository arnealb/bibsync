"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";

import { castVote, deleteProposal } from "@/app/_actions/proposals";
import { ProposalCalendarBar } from "@/components/proposals/proposal-calendar-bar";
import { ProposalCard } from "@/components/proposals/proposal-card";
import { ProposalForm } from "@/components/proposals/proposal-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useProposalsRealtime } from "@/hooks/use-proposals-realtime";
import { copy } from "@/lib/copy";
import {
  rangeFor,
  shiftAnchor,
  type CalendarView,
} from "@/lib/proposals/calendar";
import { dateLabelGroups } from "@/lib/proposals/group";
import { isProposalVisible } from "@/lib/proposals/visibility";
import { isoDatePlus } from "@/lib/time";
import type { BreakProposal, Vote, VoteValue } from "@/types/database";

interface ProposalsPanelProps {
  roomId: string;
  userId: string;
  members: Record<string, string>;
  initialProposals: BreakProposal[];
  initialVotes: Vote[];
}

export function ProposalsPanel({
  roomId,
  userId,
  members,
  initialProposals,
  initialVotes,
}: ProposalsPanelProps) {
  const [proposals, setProposals] = useState(initialProposals);
  const [votes, setVotes] = useState(initialVotes);
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [view, setView] = useState<CalendarView>("week");
  const [anchor, setAnchor] = useState(() => isoDatePlus(0));
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

  const range = rangeFor(view, anchor);
  const visible = proposals.filter((p) => isProposalVisible(p, now));
  const groups = dateLabelGroups(
    visible.filter(
      (p) => p.proposal_date >= range.start && p.proposal_date <= range.end,
    ),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{copy.proposals.title}</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button size="sm" />}>
            <Plus />
            {copy.proposals.new}
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{copy.proposals.form.title}</DialogTitle>
            </DialogHeader>
            <ProposalForm
              roomId={roomId}
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

      <ProposalCalendarBar
        view={view}
        anchor={anchor}
        onView={setView}
        onShift={(dir) => setAnchor((a) => shiftAnchor(view, a, dir))}
        onToday={() => setAnchor(isoDatePlus(0))}
      />

      {visible.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          {copy.proposals.empty}
        </p>
      ) : groups.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          {copy.proposals.calendar.emptyRange}
        </p>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <section key={group.date} className="space-y-2">
              <h3 className="text-xs font-medium text-muted-foreground uppercase">
                {group.label}
              </h3>
              <div className="space-y-3">
                {group.items.map((proposal) => (
                  <ProposalCard
                    key={proposal.id}
                    proposal={proposal}
                    votes={votes.filter((v) => v.proposal_id === proposal.id)}
                    members={members}
                    userId={userId}
                    canDelete={proposal.created_by === userId}
                    onVote={(value) => handleVote(proposal.id, value)}
                    onDelete={() => handleDelete(proposal.id)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
