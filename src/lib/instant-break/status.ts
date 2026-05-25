import { INSTANT_BREAK_WINDOW_SECONDS } from "@/lib/instant-break/config";
import type { InstantBreak, InstantBreakPush } from "@/types/database";

type BreakLike = Pick<InstantBreak, "started_at" | "duration_minutes">;
type PushLike = Pick<InstantBreakPush, "user_id" | "created_at">;

/** Epoch ms at which the break ends. */
export function breakEndsAt(b: BreakLike): number {
  return new Date(b.started_at).getTime() + b.duration_minutes * 60_000;
}

/** Whether the break is still running at `nowMs`. */
export function isBreakActive(b: BreakLike, nowMs: number): boolean {
  return breakEndsAt(b) > nowMs;
}

/** Milliseconds left until the break ends (never negative). */
export function breakRemainingMs(b: BreakLike, nowMs: number): number {
  return Math.max(0, breakEndsAt(b) - nowMs);
}

/**
 * Distinct user ids that pressed within the rolling window ending at `nowMs`.
 * This is exactly what the threshold is measured against.
 */
export function recentPushers(
  pushes: readonly PushLike[],
  nowMs: number,
  windowSeconds: number = INSTANT_BREAK_WINDOW_SECONDS,
): Set<string> {
  const cutoff = nowMs - windowSeconds * 1000;
  const ids = new Set<string>();
  for (const push of pushes) {
    if (new Date(push.created_at).getTime() >= cutoff) ids.add(push.user_id);
  }
  return ids;
}
