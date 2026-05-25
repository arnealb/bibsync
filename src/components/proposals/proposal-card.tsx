"use client";

import {
  Clock,
  Coffee,
  Sandwich,
  Trash2,
  UtensilsCrossed,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import { getInitials } from "@/lib/initials";
import { endTime, formatDateLong, formatTime, isoDatePlus } from "@/lib/time";
import { cn } from "@/lib/utils";
import { VOTE_VALUES } from "@/lib/validation/proposals";
import type { BreakProposal, ProposalType, Vote, VoteValue } from "@/types/database";

const TYPE_ICON: Record<ProposalType, typeof Coffee> = {
  lunch: Sandwich,
  dinner: UtensilsCrossed,
  coffee: Coffee,
  other: Clock,
};

const VOTE_EMOJI: Record<VoteValue, string> = {
  yes: "👍",
  maybe: "🤔",
  no: "👎",
};

function dateLabel(date: string): string {
  if (date === isoDatePlus(0)) return copy.proposals.today;
  if (date === isoDatePlus(1)) return copy.proposals.tomorrow;
  return formatDateLong(date);
}

interface ProposalCardProps {
  proposal: BreakProposal;
  votes: Vote[];
  members: Record<string, string>;
  userId: string;
  canDelete: boolean;
  onVote: (value: VoteValue) => void;
  onDelete: () => void;
}

export function ProposalCard({
  proposal,
  votes,
  members,
  userId,
  canDelete,
  onVote,
  onDelete,
}: ProposalCardProps) {
  const Icon = TYPE_ICON[proposal.proposal_type];
  const ownVote = votes.find((vote) => vote.user_id === userId)?.vote;
  const creatorName = members[proposal.created_by] ?? "—";

  return (
    <article className="rounded-lg border p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-md bg-muted">
            <Icon className="size-4.5" />
          </span>
          <div>
            <p className="font-medium">
              {copy.proposals.types[proposal.proposal_type]}
            </p>
            <p className="text-sm text-muted-foreground">
              {dateLabel(proposal.proposal_date)} ·{" "}
              {formatTime(proposal.start_time)} –{" "}
              {endTime(proposal.start_time, proposal.duration_minutes)}
            </p>
          </div>
        </div>
        {canDelete && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={copy.common.delete}
            onClick={onDelete}
          >
            <Trash2 />
          </Button>
        )}
      </div>

      <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Avatar className="size-5">
          <AvatarFallback className="text-[10px]">
            {getInitials(creatorName)}
          </AvatarFallback>
        </Avatar>
        {copy.proposals.by} {creatorName}
      </div>

      {proposal.note && <p className="mt-2 text-sm">{proposal.note}</p>}

      <div className="mt-3 grid grid-cols-3 gap-2">
        {VOTE_VALUES.map((value) => {
          const count = votes.filter((vote) => vote.vote === value).length;
          return (
            <Button
              key={value}
              variant={ownVote === value ? "default" : "outline"}
              size="sm"
              className="gap-1"
              aria-pressed={ownVote === value}
              onClick={() => onVote(value)}
            >
              <span aria-hidden>{VOTE_EMOJI[value]}</span>
              {copy.proposals.votes[value]}
              <span className="tabular-nums">{count}</span>
            </Button>
          );
        })}
      </div>

      <Voters votes={votes} members={members} />
    </article>
  );
}

function Voters({
  votes,
  members,
}: {
  votes: Vote[];
  members: Record<string, string>;
}) {
  if (votes.length === 0) {
    return (
      <p className="mt-2 text-xs text-muted-foreground">
        {copy.proposals.votes.noVotes}
      </p>
    );
  }
  return (
    <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
      {VOTE_VALUES.map((value) => {
        const names = votes
          .filter((vote) => vote.vote === value)
          .map((vote) => members[vote.user_id] ?? "—");
        if (names.length === 0) return null;
        return (
          <li key={value} className={cn("flex gap-1.5")}>
            <span aria-hidden>{VOTE_EMOJI[value]}</span>
            <span>{names.join(", ")}</span>
          </li>
        );
      })}
    </ul>
  );
}
