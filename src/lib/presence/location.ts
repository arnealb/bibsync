/**
 * Location-derived presence verdict, kept separate from the manual status so
 * the existing presence view/tests stay untouched. A member is "here" or
 * "away" only while their location check is fresh; otherwise it's "unknown"
 * (location off, never reported, or a stale reading).
 */

/** A location reading older than this is treated as unknown. */
export const LOCATION_FRESH_MS = 10 * 60 * 1000;

export type LocationStatus = "here" | "away" | "unknown";

export function locationStatus(
  row:
    | { at_location: boolean | null; location_checked_at: string | null }
    | undefined,
  nowMs: number = Date.now(),
): LocationStatus {
  if (!row || row.at_location == null || !row.location_checked_at) {
    return "unknown";
  }
  if (nowMs - Date.parse(row.location_checked_at) > LOCATION_FRESH_MS) {
    return "unknown";
  }
  return row.at_location ? "here" : "away";
}

/** Sort key: confirmed-here first, unknown next, confirmed-away last. */
export function locationSortKey(status: LocationStatus): number {
  return status === "here" ? 0 : status === "unknown" ? 1 : 2;
}
