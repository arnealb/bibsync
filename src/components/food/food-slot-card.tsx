"use client";

import { useState } from "react";

import { FoodCard } from "@/components/food/food-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { copy } from "@/lib/copy";
import type { MemberMap } from "@/lib/members";
import { voteWeight } from "@/lib/proposals/joke";
import { pickWinnerId } from "@/lib/proposals/winner";
import type { FoodSlot } from "@/lib/slots";
import type { FoodComment, FoodProposal, FoodVote, VoteValue } from "@/types/database";

interface FoodSlotCardProps {
  slot: FoodSlot;
  date: string;
  suggestions: FoodProposal[];
  votes: FoodVote[];
  comments: FoodComment[];
  members: MemberMap;
  userId: string;
  onSetPreference: (slotKey: string, date: string, choice: string) => void;
  onClearPreference: (slotKey: string) => void;
  onVote: (foodProposalId: string, value: VoteValue) => void;
  onDelete: (foodProposalId: string) => void;
  onAddComment: (foodProposalId: string, content: string) => void;
  onDeleteComment: (commentId: string) => void;
}

export function FoodSlotCard({
  slot,
  date,
  suggestions,
  votes,
  comments,
  members,
  userId,
  onSetPreference,
  onClearPreference,
  onVote,
  onDelete,
  onAddComment,
  onDeleteComment,
}: FoodSlotCardProps) {
  const presets = copy.food.presets;
  const myChoice = suggestions.find((s) => s.created_by === userId)?.choice;
  const myIsPreset = myChoice
    ? (presets as readonly string[]).includes(myChoice)
    : true;
  const [useCustom, setUseCustom] = useState(Boolean(myChoice) && !myIsPreset);
  const [choice, setChoice] = useState(
    myChoice && myIsPreset ? myChoice : slot.defaultChoice,
  );
  const [custom, setCustom] = useState(myChoice && !myIsPreset ? myChoice : "");

  function save() {
    const value = useCustom ? custom.trim() : choice;
    if (!value) return;
    onSetPreference(slot.key, date, value);
  }

  const winnerId = pickWinnerId(
    suggestions.map((s) => s.id),
    (id) =>
      votes
        .filter((v) => v.food_proposal_id === id && v.vote === "yes")
        .reduce((sum, v) => sum + voteWeight(members[v.user_id]?.name ?? ""), 0),
  );

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-semibold">{slot.label}</h3>
        <span className="text-xs text-muted-foreground">
          {copy.food.slots.defaultLabel} {slot.defaultChoice}
        </span>
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">
          {copy.food.slots.yourChoice}
        </Label>
        <div className="flex flex-wrap gap-2">
          {presets.map((preset) => (
            <Button
              key={preset}
              type="button"
              size="sm"
              variant={!useCustom && choice === preset ? "default" : "outline"}
              onClick={() => {
                setUseCustom(false);
                setChoice(preset);
              }}
            >
              {preset}
            </Button>
          ))}
          <Button
            type="button"
            size="sm"
            variant={useCustom ? "default" : "outline"}
            onClick={() => setUseCustom(true)}
          >
            {copy.food.custom}
          </Button>
        </div>
        {useCustom && (
          <Input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            maxLength={60}
            placeholder={copy.food.form.customPlaceholder}
          />
        )}
        <div className="flex gap-2">
          <Button size="sm" onClick={save}>
            {copy.food.slots.save}
          </Button>
          {myChoice && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onClearPreference(slot.key)}
            >
              {copy.food.slots.clear}
            </Button>
          )}
        </div>
      </div>

      {suggestions.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {copy.food.slots.empty}
        </p>
      ) : (
        <div className="space-y-3">
          {suggestions.map((suggestion) => (
            <FoodCard
              key={suggestion.id}
              proposal={suggestion}
              votes={votes.filter((v) => v.food_proposal_id === suggestion.id)}
              comments={comments.filter(
                (c) => c.food_proposal_id === suggestion.id,
              )}
              members={members}
              userId={userId}
              canDelete={suggestion.created_by === userId}
              isWinner={suggestion.id === winnerId}
              onVote={(value) => onVote(suggestion.id, value)}
              onDelete={() => onDelete(suggestion.id)}
              onAddComment={onAddComment}
              onDeleteComment={onDeleteComment}
            />
          ))}
        </div>
      )}
    </div>
  );
}
