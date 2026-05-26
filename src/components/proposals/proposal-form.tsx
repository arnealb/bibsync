"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { createProposal } from "@/app/_actions/proposals";
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
import { Textarea } from "@/components/ui/textarea";
import { copy } from "@/lib/copy";
import { isoDatePlus } from "@/lib/time";
import { DURATION_OPTIONS, PROPOSAL_TYPES } from "@/lib/validation/proposals";
import type { BreakProposal, ProposalType, RoomPlace } from "@/types/database";

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = ["00", "15", "30", "45"];

export function ProposalForm({
  roomId,
  places,
  onCreated,
}: {
  roomId: string;
  places: RoomPlace[];
  onCreated: (proposal: BreakProposal) => void;
}) {
  const [type, setType] = useState<ProposalType>("lunch");
  const [date, setDate] = useState(isoDatePlus(0));
  const [hour, setHour] = useState("12");
  const [minute, setMinute] = useState("30");
  const [duration, setDuration] = useState("30");
  const [destination, setDestination] = useState("");
  const [isWalk, setIsWalk] = useState(false);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await createProposal({
        roomId,
        proposalType: type,
        proposalDate: date,
        startTime: `${hour}:${minute}`,
        durationMinutes: Number(duration),
        destination: destination.trim() || undefined,
        isWalk,
        note: note.trim() || undefined,
      });
      if (result.ok) {
        toast.success(copy.proposals.created);
        onCreated(result.proposal);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>{copy.proposals.form.typeLabel}</Label>
        <Select
          value={type}
          onValueChange={(v) => setType((v ?? "lunch") as ProposalType)}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROPOSAL_TYPES.map((value) => (
              <SelectItem key={value} value={value}>
                {copy.proposals.types[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="proposal-date">{copy.proposals.form.dateLabel}</Label>
        <input
          id="proposal-date"
          type="date"
          value={date}
          min={isoDatePlus(0)}
          max={isoDatePlus(7)}
          onChange={(e) => setDate(e.target.value)}
          className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>{copy.proposals.form.timeLabel}</Label>
          <div className="flex items-center gap-2">
            <Select value={hour} onValueChange={(v) => setHour(v ?? "12")}>
              <SelectTrigger className="w-full" aria-label={copy.proposals.form.hour}>
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
            <Select value={minute} onValueChange={(v) => setMinute(v ?? "30")}>
              <SelectTrigger className="w-full" aria-label={copy.proposals.form.minute}>
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
        <div className="space-y-2">
          <Label>{copy.proposals.form.durationLabel}</Label>
          <Select
            value={duration}
            onValueChange={(v) => setDuration(v ?? "30")}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DURATION_OPTIONS.map((value) => (
                <SelectItem key={value} value={String(value)}>
                  {copy.proposals.duration(value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="proposal-dest">
          {copy.proposals.form.destinationLabel}
        </Label>
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
        <Input
          id="proposal-dest"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          maxLength={80}
          placeholder={copy.proposals.form.destinationPlaceholder}
        />
        <label className="flex w-fit items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isWalk}
            onChange={(e) => setIsWalk(e.target.checked)}
            className="size-4 accent-emerald-600"
          />
          {copy.proposals.form.walkLabel}
        </label>
      </div>

      <div className="space-y-2">
        <Label htmlFor="proposal-note">{copy.proposals.form.noteLabel}</Label>
        <Textarea
          id="proposal-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={200}
          rows={2}
          placeholder={copy.proposals.form.notePlaceholder}
        />
      </div>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? copy.proposals.form.submitting : copy.proposals.form.submit}
      </Button>
    </form>
  );
}
