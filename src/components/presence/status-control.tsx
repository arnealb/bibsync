"use client";

import { ChevronsUpDown, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { copy } from "@/lib/copy";
import { PRESENCE_EMOJI } from "@/lib/presence/display";
import { formatTime } from "@/lib/time";
import {
  PRESENCE_STATUSES,
  STATUSES_WITH_BACK_AT,
} from "@/lib/validation/presence";
import type { PresenceStatus } from "@/types/database";

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = ["00", "15", "30", "45"];

interface StatusControlProps {
  status: PresenceStatus;
  backAt: string | null;
  onSelect: (status: PresenceStatus, backAt: string | null) => void;
}

export function StatusControl({ status, backAt, onSelect }: StatusControlProps) {
  const showBackAt = STATUSES_WITH_BACK_AT.includes(status);
  const [hour, minute] = backAt
    ? formatTime(backAt).split(":")
    : ["13", "00"];

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <Label className="text-xs text-muted-foreground">
        {copy.presence.yourStatus}
      </Label>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="outline" className="w-full justify-between" />}
        >
          <span>
            {PRESENCE_EMOJI[status]} {copy.presence.statuses[status]}
          </span>
          <ChevronsUpDown className="size-4 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-(--anchor-width)">
          {PRESENCE_STATUSES.map((value) => (
            <DropdownMenuItem key={value} onClick={() => onSelect(value, null)}>
              <span>{PRESENCE_EMOJI[value]}</span>
              {copy.presence.statuses[value]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {showBackAt && (
        <div className="flex items-center gap-2 pt-1">
          <span className="text-xs text-muted-foreground">
            {copy.presence.backAt}
          </span>
          <Select
            value={hour}
            onValueChange={(v) => onSelect(status, `${v ?? "13"}:${minute}`)}
          >
            <SelectTrigger size="sm" aria-label="Uur">
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
          <Select
            value={minute}
            onValueChange={(v) => onSelect(status, `${hour}:${v ?? "00"}`)}
          >
            <SelectTrigger size="sm" aria-label="Minuten">
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
          {backAt && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={copy.common.delete}
              onClick={() => onSelect(status, null)}
            >
              <X />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
