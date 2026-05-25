"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import { rangeLabel, type CalendarView } from "@/lib/proposals/calendar";

const VIEWS: CalendarView[] = ["day", "week", "month"];

interface ProposalCalendarBarProps {
  view: CalendarView;
  anchor: string;
  onView: (view: CalendarView) => void;
  onShift: (direction: 1 | -1) => void;
  onToday: () => void;
}

export function ProposalCalendarBar({
  view,
  anchor,
  onView,
  onShift,
  onToday,
}: ProposalCalendarBarProps) {
  return (
    <div className="space-y-2">
      <div className="flex w-fit items-center gap-1 rounded-lg border p-1">
        {VIEWS.map((value) => (
          <Button
            key={value}
            size="sm"
            variant={value === view ? "default" : "ghost"}
            onClick={() => onView(value)}
          >
            {copy.proposals.calendar[value]}
          </Button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="icon-sm"
          variant="outline"
          aria-label={copy.proposals.calendar.prev}
          onClick={() => onShift(-1)}
        >
          <ChevronLeft />
        </Button>
        <span className="flex-1 text-sm font-medium capitalize">
          {rangeLabel(view, anchor)}
        </span>
        <Button
          size="icon-sm"
          variant="outline"
          aria-label={copy.proposals.calendar.next}
          onClick={() => onShift(1)}
        >
          <ChevronRight />
        </Button>
        <Button size="sm" variant="ghost" onClick={onToday}>
          {copy.proposals.calendar.today}
        </Button>
      </div>
    </div>
  );
}
