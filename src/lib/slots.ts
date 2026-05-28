import type { ProposalType } from "@/types/database";

export interface BreakSlot {
  key: string;
  label: string;
  type: ProposalType;
  defaultTime: string;
}

/** The fixed daily break/meal slots, in order. */
export const BREAK_SLOTS: BreakSlot[] = [
  { key: "ochtendpauze", label: "Ochtendpauze", type: "coffee", defaultTime: "10:30" },
  { key: "middageten", label: "Middageten", type: "lunch", defaultTime: "12:00" },
  { key: "middagpauze", label: "Middagpauze", type: "coffee", defaultTime: "15:30" },
  { key: "avondeten", label: "Avondeten", type: "dinner", defaultTime: "18:30" },
  { key: "avondpauze", label: "Avondpauze", type: "coffee", defaultTime: "21:30" },
];

function toMinutes(time: string): number {
  const [h, m] = time.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}

function fromMinutes(total: number): string {
  const wrapped = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Average of the given times (HH:MM), rounded to 5 min; `fallback` if empty. */
export function averageTime(times: string[], fallback: string): string {
  if (times.length === 0) return fallback;
  const avg =
    times.reduce((sum, t) => sum + toMinutes(t), 0) / times.length;
  return fromMinutes(Math.round(avg / 5) * 5);
}
