import { TZDate } from "@date-fns/tz";
import { addDays, format, formatDistanceToNow } from "date-fns";
import { nl } from "date-fns/locale";

/**
 * Time helpers — everything in 24h notation, Europe/Brussels timezone,
 * Dutch locale. Prepared here for deel 2/3 (proposals, presence, chat).
 */
export const TIME_ZONE = "Europe/Brussels";

/** Current moment as a Brussels-zoned date. */
export function nowInBrussels(): TZDate {
  return TZDate.tz(TIME_ZONE);
}

/** ISO date string (YYYY-MM-DD) for "today" in Brussels. */
export function todayInBrussels(): string {
  return format(nowInBrussels(), "yyyy-MM-dd");
}

/** ISO date (YYYY-MM-DD) `days` from today in Brussels (e.g. +7). */
export function isoDatePlus(days: number): string {
  return format(addDays(nowInBrussels(), days), "yyyy-MM-dd");
}

/** End time `HH:MM` for a start time + duration, wrapping past midnight. */
export function endTime(start: string, durationMinutes: number): string {
  const [hours, minutes] = start.split(":").map(Number);
  const total = (hours * 60 + minutes + durationMinutes) % (24 * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Format a timestamp as `dd MMM yyyy HH:mm` in Brussels time. */
export function formatDateTime(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return format(new TZDate(date, TIME_ZONE), "dd MMM yyyy HH:mm", {
    locale: nl,
  });
}

/** Format a date string (YYYY-MM-DD) as `EEEE d MMMM` (e.g. "maandag 5 mei"). */
export function formatDateLong(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return format(new TZDate(date, TIME_ZONE), "EEEE d MMMM", { locale: nl });
}

/** Trim a SQL `time` value (`HH:MM[:SS]`) to `HH:MM`. */
export function formatTime(time: string): string {
  return time.slice(0, 5);
}

/** Relative time (e.g. "3 minuten geleden"), Dutch. */
export function formatRelative(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return formatDistanceToNow(date, { addSuffix: true, locale: nl });
}
