import {
  addDays,
  addMonths,
  addWeeks,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { nl } from "date-fns/locale";

export type CalendarView = "day" | "week" | "month";

/** Monday-based week, matching Belgian convention. */
const WEEK_OPTS = { weekStartsOn: 1 } as const;

function iso(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

function toDate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00`);
}

/** Inclusive [start, end] date range (YYYY-MM-DD) for a view + anchor day. */
export function rangeFor(
  view: CalendarView,
  anchorIso: string,
): { start: string; end: string } {
  const anchor = toDate(anchorIso);
  if (view === "day") return { start: anchorIso, end: anchorIso };
  if (view === "week") {
    return {
      start: iso(startOfWeek(anchor, WEEK_OPTS)),
      end: iso(endOfWeek(anchor, WEEK_OPTS)),
    };
  }
  return { start: iso(startOfMonth(anchor)), end: iso(endOfMonth(anchor)) };
}

/** Moves the anchor one unit in the given direction (-1 / +1). */
export function shiftAnchor(
  view: CalendarView,
  anchorIso: string,
  direction: 1 | -1,
): string {
  const anchor = toDate(anchorIso);
  if (view === "day") return iso(addDays(anchor, direction));
  if (view === "week") return iso(addWeeks(anchor, direction));
  return iso(addMonths(anchor, direction));
}

/** Human label for the current range (Dutch). */
export function rangeLabel(view: CalendarView, anchorIso: string): string {
  const anchor = toDate(anchorIso);
  if (view === "day") return format(anchor, "EEEE d MMMM", { locale: nl });
  if (view === "week") {
    const start = startOfWeek(anchor, WEEK_OPTS);
    const end = endOfWeek(anchor, WEEK_OPTS);
    return `${format(start, "d MMM", { locale: nl })} – ${format(end, "d MMM", { locale: nl })}`;
  }
  return format(anchor, "MMMM yyyy", { locale: nl });
}
