import type { ProposalType } from "@/types/database";

export interface BreakSlot {
  key: string;
  label: string;
  type: ProposalType;
  defaultTime: string;
  /** End of the slot's window — it stays settable until this time of day, even
   *  once its decided time has passed. */
  until: string;
}

/** The fixed daily break/meal slots, in order. */
export const BREAK_SLOTS: BreakSlot[] = [
  { key: "ochtendpauze", label: "Ochtendpauze", type: "coffee", defaultTime: "10:30", until: "11:30" },
  { key: "middageten", label: "Middageten", type: "lunch", defaultTime: "12:30", until: "13:00" },
  { key: "middagpauze", label: "Middagpauze", type: "coffee", defaultTime: "15:30", until: "16:30" },
  { key: "avondeten", label: "Avondeten", type: "dinner", defaultTime: "18:30", until: "19:30" },
  { key: "avondpauze", label: "Avondpauze", type: "coffee", defaultTime: "21:30", until: "22:30" },
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

/** How close (minutes) a free proposal must be to a same-type slot to clash. */
export const SLOT_WINDOW_RADIUS_MIN = 30;

/**
 * The fixed slot a free proposal would step on, or null. A free proposal of the
 * same type within {@link SLOT_WINDOW_RADIUS_MIN} of a slot's time belongs in
 * that slot's "vast moment", not as a separate free proposal.
 */
export function conflictingSlot(
  type: ProposalType,
  time: string,
): BreakSlot | null {
  const minutes = toMinutes(time);
  for (const slot of BREAK_SLOTS) {
    if (slot.type !== type) continue;
    if (Math.abs(minutes - toMinutes(slot.defaultTime)) <= SLOT_WINDOW_RADIUS_MIN) {
      return slot;
    }
  }
  return null;
}
