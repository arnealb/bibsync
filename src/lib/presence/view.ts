import { formatClock, todayResetThreshold } from "@/lib/time";
import type { Presence, PresenceStatus } from "@/types/database";

const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

export type PresenceView =
  | { kind: "status"; status: PresenceStatus; backAt: string | null }
  | { kind: "lastSeen"; time: string };

/** Default view for a member without a presence row. */
export const DEFAULT_VIEW: PresenceView = {
  kind: "status",
  status: "studying",
  backAt: null,
};

/**
 * Applies the daily lazy reset (anything set before today 04:00 counts as
 * "studying" again) and the staleness rule (>4h old shows "last seen").
 */
export function presenceView(row: Presence | undefined): PresenceView {
  if (!row) return DEFAULT_VIEW;

  const updated = new Date(row.updated_at).getTime();
  if (updated < todayResetThreshold()) return DEFAULT_VIEW;

  if (Date.now() - updated > FOUR_HOURS_MS) {
    return { kind: "lastSeen", time: formatClock(row.updated_at) };
  }

  return { kind: "status", status: row.status, backAt: row.back_at };
}

/** Sort key: active first, then away, done, finally long-idle members. */
export function presenceSortKey(view: PresenceView): number {
  if (view.kind === "lastSeen") return 3;
  switch (view.status) {
    case "studying":
    case "break":
    case "lunch":
      return 0;
    case "away":
      return 1;
    case "done":
      return 2;
  }
}
