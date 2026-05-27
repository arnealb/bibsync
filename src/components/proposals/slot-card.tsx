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
import { RouteField } from "@/components/routes/route-field";
import { copy } from "@/lib/copy";
import type { MemberMap } from "@/lib/members";
import { toRoutePoints, type RoutePoint } from "@/lib/routes/types";
import { voteWeight } from "@/lib/proposals/joke";
import { decideSlotTime } from "@/lib/proposals/winner";
import { type BreakSlot } from "@/lib/slots";
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
    routePoints?: RoutePoint[],
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
  const [routePoints, setRoutePoints] = useState<RoutePoint[]>(
    toRoutePoints(mySuggestion?.route_points),
  );
  const ordered = [...suggestions].sort((a, b) =>
    a.start_time.localeCompare(b.start_time),
  );

  // The break is simply the time the most people back; no averaging.
  const decidedTime =
    decideSlotTime(suggestions, votes, (uid) =>
      voteWeight(members[uid]?.name ?? ""),
    ) ?? slot.defaultTime.slice(0, 5);
  const isDefault = suggestions.length === 0;

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <h3 className="font-semibold">{slot.label}</h3>

      <div className="rounded-lg border-2 border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-center">
        <p className="text-[11px] font-semibold tracking-wide text-emerald-700 uppercase dark:text-emerald-400">
          {copy.proposals.slots.breakAt}
        </p>
        <p className="text-5xl leading-tight font-black tabular-nums text-emerald-700 dark:text-emerald-400">
          {decidedTime}
        </p>
        {isDefault && (
          <p className="text-xs text-muted-foreground">
            {copy.proposals.slots.defaultNote}
          </p>
        )}
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
              routePoints.length ? routePoints : undefined,
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
                  setRoutePoints(toRoutePoints(place.points));
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
        <RouteField points={routePoints} editable onChange={setRoutePoints} />
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
