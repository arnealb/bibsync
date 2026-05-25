"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { createFoodProposal } from "@/app/_actions/food";
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
import type { FoodProposal } from "@/types/database";

const DATE_INPUT_CLASS =
  "flex h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = ["00", "15", "30", "45"];

export function FoodForm({
  roomId,
  onCreated,
}: {
  roomId: string;
  onCreated: (proposal: FoodProposal) => void;
}) {
  const presets = copy.food.presets;
  const [choice, setChoice] = useState<string>(presets[0]);
  const [useCustom, setUseCustom] = useState(false);
  const [custom, setCustom] = useState("");
  const [date, setDate] = useState(isoDatePlus(0));
  const [hour, setHour] = useState("12");
  const [minute, setMinute] = useState("00");
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const finalChoice = useCustom ? custom.trim() : choice;
    startTransition(async () => {
      const result = await createFoodProposal({
        roomId,
        choice: finalChoice,
        foodDate: date,
        foodTime: `${hour}:${minute}`,
        note: note.trim() || undefined,
      });
      if (result.ok) {
        toast.success(copy.food.created);
        onCreated(result.proposal);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>{copy.food.form.choiceLabel}</Label>
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
            autoFocus
          />
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="food-date">{copy.food.form.dateLabel}</Label>
        <input
          id="food-date"
          type="date"
          value={date}
          min={isoDatePlus(0)}
          max={isoDatePlus(7)}
          onChange={(e) => setDate(e.target.value)}
          className={DATE_INPUT_CLASS}
          required
        />
      </div>

      <div className="space-y-2">
        <Label>{copy.food.form.timeLabel}</Label>
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
          <Select value={minute} onValueChange={(v) => setMinute(v ?? "00")}>
            <SelectTrigger
              className="w-full"
              aria-label={copy.proposals.form.minute}
            >
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
        <Label htmlFor="food-note">{copy.food.form.noteLabel}</Label>
        <Textarea
          id="food-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={200}
          rows={2}
          placeholder={copy.food.form.notePlaceholder}
        />
      </div>

      <Button
        type="submit"
        className="w-full"
        disabled={pending || (useCustom && custom.trim().length === 0)}
      >
        {pending ? copy.food.form.submitting : copy.food.form.submit}
      </Button>
    </form>
  );
}
