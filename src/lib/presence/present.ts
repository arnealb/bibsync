import { locationStatus } from "@/lib/presence/location";

/**
 * Combined presence verdict: a member is present when location confirms it
 * ("here") OR they manually checked in today ("checked-in"). This lets people
 * who won't share their location still count as present (sidebar + vote
 * tallies). "away" is a fresh location reading that says they're not here and
 * they haven't checked in; otherwise "unknown".
 */
export type PresenceVerdict = "here" | "checked-in" | "away" | "unknown";

export interface PresenceRowLite {
  at_location: boolean | null;
  location_checked_at: string | null;
  checked_in_on: string | null;
}

export function presenceVerdict(
  row: PresenceRowLite | undefined,
  today: string,
  nowMs: number = Date.now(),
): PresenceVerdict {
  if (!row) return "unknown";
  const loc = locationStatus(row, nowMs);
  if (loc === "here") return "here";
  if (row.checked_in_on === today) return "checked-in";
  if (loc === "away") return "away";
  return "unknown";
}

/** True when the verdict means the member is at the room. */
export function isPresent(verdict: PresenceVerdict): boolean {
  return verdict === "here" || verdict === "checked-in";
}

/** Sort key: present first (here, then checked-in), unknown, away last. */
export function presenceVerdictSortKey(verdict: PresenceVerdict): number {
  switch (verdict) {
    case "here":
      return 0;
    case "checked-in":
      return 1;
    case "unknown":
      return 2;
    case "away":
      return 3;
  }
}
