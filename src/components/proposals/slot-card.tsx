"use client";

import { useState } from "react";

import { ProposalCard } from "@/components/proposals/proposal-card";
import { Button } from "@/components/ui/button";
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
import { averageTime, type BreakSlot } from "@/lib/slots";
import type {
  BreakProposal,
  ProposalComment,
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
  onSetPreference: (slotKey: string, date: string, time: string) => void;
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
  onSetPreference,
  onClearPreference,
  onVote,
  onDelete,
  onAddComment,
  onDeleteComment,
}: SlotCardProps) {
  const myPref = suggestions.find((s) => s.created_by === userId)?.start_time;
  const initial = (myPref ?? slot.defaultTime).slice(0, 5);
  const [hour, setHour] = useState(initial.split(":")[0]);
  const [minute, setMinute] = useState(initial.split(":")[1]);
  const average = averageTime(
    suggestions.map((s) => s.start_time),
    slot.defaultTime,
  );

  const ordered = [...suggestions].sort((a, b) =>
    a.start_time.localeCompare(b.start_time),
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
          onClick={() => onSetPreference(slot.key, date, `${hour}:${minute}`)}
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
