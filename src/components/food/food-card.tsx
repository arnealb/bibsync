"use client";

import { Trash2, UtensilsCrossed } from "lucide-react";

import { ProposalComments } from "@/components/proposals/proposal-comments";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { copy } from "@/lib/copy";
import type { MemberMap } from "@/lib/members";
import { formatTally, voteWeight } from "@/lib/proposals/joke";
import { formatDateLong, formatTime, isoDatePlus } from "@/lib/time";
import { cn } from "@/lib/utils";
import { VOTE_VALUES } from "@/lib/validation/proposals";
import type { FoodComment, FoodProposal, FoodVote, VoteValue } from "@/types/database";

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

interface FoodCardProps {
  proposal: FoodProposal;
  votes: FoodVote[];
  comments: FoodComment[];
  members: MemberMap;
  userId: string;
  canDelete: boolean;
  isWinner?: boolean;
  onVote: (value: VoteValue) => void;
  onDelete: () => void;
  onAddComment: (foodProposalId: string, content: string) => void;
  onDeleteComment: (commentId: string) => void;
}

export function FoodCard({
  proposal,
  votes,
  comments,
  members,
  userId,
  canDelete,
  isWinner,
  onVote,
  onDelete,
  onAddComment,
  onDeleteComment,
}: FoodCardProps) {
  const ownVote = votes.find((vote) => vote.user_id === userId)?.vote;
  const creator = members[proposal.created_by];
  const creatorName = creator?.name ?? "—";

  return (
    <article
      className={cn(
        "rounded-lg border p-4",
        isWinner && "border-emerald-500/50 ring-1 ring-emerald-500/30",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-md bg-muted">
            <UtensilsCrossed className="size-4.5" />
          </span>
          <div>
            <p className="flex items-center gap-1.5 font-medium">
              {proposal.choice}
              {isWinner && (
                <Badge className="bg-emerald-600 text-white">
                  🏆 {copy.proposals.winner}
                </Badge>
              )}
            </p>
            <p className="text-sm text-muted-foreground">
              {dateLabel(proposal.food_date)}
              {proposal.food_time && ` · ${formatTime(proposal.food_time)}`}
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

      {proposal.note && <p className="mt-2 text-sm">{proposal.note}</p>}

      <div className="mt-3 grid grid-cols-3 gap-2">
        {VOTE_VALUES.map((value) => {
          const count = votes
            .filter((vote) => vote.vote === value)
            .reduce(
              (sum, vote) =>
                sum + voteWeight(members[vote.user_id]?.name ?? ""),
              0,
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
              <span className="tabular-nums">{formatTally(count)}</span>
            </Button>
          );
        })}
      </div>

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
