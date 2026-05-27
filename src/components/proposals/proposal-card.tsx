"use client";

import {
  Clock,
  Coffee,
  Sandwich,
  Trash2,
  UtensilsCrossed,
} from "lucide-react";

import { ProposalComments } from "@/components/proposals/proposal-comments";
import { RouteField } from "@/components/routes/route-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { copy } from "@/lib/copy";
import { toRoutePoints } from "@/lib/routes/types";
import type { MemberMap } from "@/lib/members";
import { formatTally, voteWeight } from "@/lib/proposals/joke";
import { presentTally } from "@/lib/proposals/present-tally";
import { endTime, formatDateLong, formatTime, isoDatePlus } from "@/lib/time";
import { cn } from "@/lib/utils";
import { VOTE_VALUES } from "@/lib/validation/proposals";
import type {
  BreakProposal,
  ProposalComment,
  ProposalType,
  Vote,
  VoteValue,
} from "@/types/database";

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
  comments: ProposalComment[];
  members: MemberMap;
  userId: string;
  canDelete: boolean;
  isWinner?: boolean;
  /** A free-form proposal (not a fixed slot) — gets a distinct accent. */
  freeProposal?: boolean;
  /** Members currently present at the room; when set, tallies count only them. */
  presentIds?: Set<string>;
  onVote: (value: VoteValue) => void;
  onDelete: () => void;
  onAddComment: (proposalId: string, content: string) => void;
  onDeleteComment: (commentId: string) => void;
}

export function ProposalCard({
  proposal,
  votes,
  comments,
  members,
  userId,
  canDelete,
  isWinner,
  freeProposal,
  presentIds,
  onVote,
  onDelete,
  onAddComment,
  onDeleteComment,
}: ProposalCardProps) {
  const Icon = TYPE_ICON[proposal.proposal_type];
  const ownVote = votes.find((vote) => vote.user_id === userId)?.vote;
  const creator = members[proposal.created_by];
  const creatorName = creator?.name ?? "—";
  // When we know who's actually present, the tally counts only them ("3/5").
  const present =
    presentIds && presentIds.size > 0
      ? presentTally(votes, presentIds)
      : null;

  return (
    <article
      className={cn(
        "rounded-lg border bg-card p-4 shadow-sm",
        freeProposal && "border-amber-500/60 bg-amber-500/5",
        isWinner && "border-emerald-500/50 ring-1 ring-emerald-500/30",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-md bg-muted">
            <Icon className="size-4.5" />
          </span>
          <div>
            <p className="flex flex-wrap items-center gap-1.5 font-medium">
              {copy.proposals.types[proposal.proposal_type]}
              {freeProposal && (
                <Badge className="border-amber-500 bg-amber-500/15 text-amber-700 dark:text-amber-400">
                  💡 {copy.proposals.freeProposal}
                </Badge>
              )}
              {isWinner && (
                <Badge className="bg-emerald-600 text-white">
                  🏆 {copy.proposals.winner}
                </Badge>
              )}
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
        <UserAvatar
          name={creatorName}
          avatarUrl={creator?.avatarUrl}
          className="size-5"
          fallbackClassName="text-[10px]"
        />
        {copy.proposals.by} {creatorName}
      </div>

      {proposal.destination && (
        <p className="mt-2 flex items-center gap-1.5 text-sm font-medium">
          <span aria-hidden>
            {proposal.is_walk ? copy.proposals.walkBy : copy.proposals.destinationBy}
          </span>
          {proposal.destination}
        </p>
      )}

      {proposal.route_points && (
        <div className="mt-2">
          <RouteField points={toRoutePoints(proposal.route_points)} />
        </div>
      )}

      {proposal.note && <p className="mt-2 text-sm">{proposal.note}</p>}

      <div className="mt-3 grid grid-cols-3 gap-2">
        {VOTE_VALUES.map((value) => {
          const label = present
            ? `${present.counts[value]}/${present.total}`
            : formatTally(
                votes
                  .filter((vote) => vote.vote === value)
                  .reduce(
                    (sum, vote) =>
                      sum + voteWeight(members[vote.user_id]?.name ?? ""),
                    0,
                  ),
              );
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
              <span className="tabular-nums">{label}</span>
            </Button>
          );
        })}
      </div>
      {present && (
        <p className="mt-1 text-center text-[11px] text-muted-foreground">
          {copy.proposals.votes.presentBasis(present.total)}
        </p>
      )}

      <Voters votes={votes} members={members} />

      <ProposalComments
        proposalId={proposal.id}
        comments={comments}
        members={members}
        userId={userId}
        onAdd={onAddComment}
        onDelete={onDeleteComment}
      />
    </article>
  );
}

function Voters({
  votes,
  members,
}: {
  votes: Vote[];
  members: MemberMap;
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
          .map((vote) => members[vote.user_id]?.name ?? "—");
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
