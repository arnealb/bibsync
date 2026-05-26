"use client";

import { useState } from "react";

import { ProposalCard } from "@/components/proposals/proposal-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { copy } from "@/lib/copy";
import type { MemberMap } from "@/lib/members";
import { voteWeight } from "@/lib/proposals/joke";
import { pickWinnerId } from "@/lib/proposals/winner";
import { averageTime, type BreakSlot } from "@/lib/slots";
import type {
  BreakProposal,
  ProposalComment,
  RoomPlace,
  Vote,
  VoteValue,
} from "@/types/database";

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 12 }, (_, i) =>
  String(i * 5).padStart(2, "0"),
);

interface SlotCardProps {
  slot: BreakSlot;
  date: string;
  suggestions: BreakProposal[];
  votes: Vote[];
  comments: ProposalComment[];
  members: MemberMap;
  userId: string;
  places: RoomPlace[];
  onSetPreference: (
    slotKey: string,
    date: string,
    time: string,
    destination?: string,
    isWalk?: boolean,
  ) => void;
  onClearPreference: (slotKey: string) => void;
  onVote: (proposalId: string, value: VoteValue) => void;
  onDelete: (proposalId: string) => void;
  onAddComment: (proposalId: string, content: string) => void;
  onDeleteComment: (commentId: string) => void;
}

export function SlotCard({
  slot,
  date,
  suggestions,
  votes,
  comments,
  members,
  userId,
  places,
  onSetPreference,
  onClearPreference,
  onVote,
  onDelete,
  onAddComment,
  onDeleteComment,
}: SlotCardProps) {
  const mySuggestion = suggestions.find((s) => s.created_by === userId);
  const myPref = mySuggestion?.start_time;
  const initial = (myPref ?? slot.defaultTime).slice(0, 5);
  const [hour, setHour] = useState(initial.split(":")[0]);
  const [minute, setMinute] = useState(initial.split(":")[1]);
  const [destination, setDestination] = useState(
    mySuggestion?.destination ?? "",
  );
  const [isWalk, setIsWalk] = useState(mySuggestion?.is_walk ?? false);
  const average = averageTime(
    suggestions.map((s) => s.start_time),
    slot.defaultTime,
  );

  const ordered = [...suggestions].sort((a, b) =>
    a.start_time.localeCompare(b.start_time),
  );

  const winnerId = pickWinnerId(
    ordered.map((s) => s.id),
    (id) =>
      votes
        .filter((v) => v.proposal_id === id && v.vote === "yes")
        .reduce((sum, v) => sum + voteWeight(members[v.user_id]?.name ?? ""), 0),
  );

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-semibold">{slot.label}</h3>
        <div className="text-right">
          <span className="text-lg font-bold tabular-nums">{average}</span>
          <span className="ml-1 text-xs text-muted-foreground">
            {copy.proposals.slots.defaultLabel} {slot.defaultTime}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">
            {copy.proposals.slots.yourPref}
          </Label>
          <div className="flex items-center gap-1">
            <Select value={hour} onValueChange={(v) => setHour(v ?? "12")}>
              <SelectTrigger size="sm" className="w-16">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HOURS.map((h) => (
                  <SelectItem key={h} value={h}>
                    {h}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-muted-foreground">:</span>
            <Select value={minute} onValueChange={(v) => setMinute(v ?? "00")}>
              <SelectTrigger size="sm" className="w-16">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MINUTES.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button
          size="sm"
          onClick={() =>
            onSetPreference(
              slot.key,
              date,
              `${hour}:${minute}`,
              destination.trim() || undefined,
              isWalk,
            )
          }
        >
          {copy.proposals.slots.save}
        </Button>
        {myPref && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onClearPreference(slot.key)}
          >
            {copy.proposals.slots.clear}
          </Button>
        )}
      </div>

      <div className="space-y-1.5">
        {places.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {places.map((place) => (
              <button
                key={place.id}
                type="button"
                onClick={() => {
                  setDestination(place.name);
                  setIsWalk(place.is_walk);
                }}
                className="rounded-full border px-2 py-0.5 text-xs hover:bg-muted"
              >
                {place.is_walk ? "🚶 " : ""}
                {place.name}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <Input
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            maxLength={80}
            placeholder={copy.proposals.form.destinationPlaceholder}
            className="h-8 flex-1"
          />
          <label className="flex shrink-0 items-center gap-1.5 text-xs">
            <input
              type="checkbox"
              checked={isWalk}
              onChange={(e) => setIsWalk(e.target.checked)}
              className="size-4 accent-emerald-600"
            />
            {copy.proposals.form.walkLabel}
          </label>
        </div>
      </div>

      {ordered.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {copy.proposals.slots.empty}
        </p>
      ) : (
        <div className="space-y-3">
          {ordered.map((suggestion) => (
            <ProposalCard
              key={suggestion.id}
              proposal={suggestion}
              votes={votes.filter((v) => v.proposal_id === suggestion.id)}
              comments={comments.filter(
                (c) => c.proposal_id === suggestion.id,
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
