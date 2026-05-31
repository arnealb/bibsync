import {
  CRASH_GROWTH_PER_SEC,
  CRASH_HOUSE_EDGE,
  CRASH_MAX_BP,
} from "@/lib/crash/config";

/** Pure, server-authoritative Crash math. No persistence here. */

export type CrashStatus = "running" | "cashed" | "busted";

/** Public round state the client may see (crash point only once the round ends). */
export interface CrashRoundState {
  status: CrashStatus;
  bet: number;
  /** Server timestamp the rocket started rising (ISO). */
  startedAt: string;
  /** Server "now" at the moment this state was produced (ISO) — clock sync. */
  serverNow: string;
  /** Where it crashed, in basis points — null while running. */
  crashBp: number | null;
  /** Multiplier you cashed out at, in basis points — null unless cashed. */
  cashoutBp: number | null;
  payout: number;
}

/**
 * Roll a crash point in basis points. The tail follows P(C ≥ x) =
 * (1 − houseEdge) / x: ~1% instant-bust at 1.00x, 1% house edge on any
 * cash-out point.
 */
export function crashPointBp(rng: () => number): number {
  const r = (1 - CRASH_HOUSE_EDGE) / (1 - rng());
  if (r < 1) return 100; // instant bust at 1.00x
  return Math.min(CRASH_MAX_BP, Math.floor(r * 100));
}

/** The rocket's multiplier (basis points) after `ms` elapsed. */
export function crashMultiplierAtMs(ms: number): number {
  if (ms <= 0) return 100;
  const mult = CRASH_GROWTH_PER_SEC ** (ms / 1000);
  return Math.min(CRASH_MAX_BP, Math.floor(mult * 100));
}

/** Has the round already crashed by `elapsedMs`? */
export function crashHasBusted(elapsedMs: number, crashBp: number): boolean {
  return crashMultiplierAtMs(elapsedMs) >= crashBp;
}

/**
 * Settle a cash-out. `claimedBp` is the multiplier the client showed at the
 * instant the player clicked — this, not the request's arrival time, decides
 * win/loss, so network latency can't rob a click that landed before the crash.
 * It's still capped to the server-elapsed multiplier so you can't bank a value
 * beyond what time allows (no future-claiming). You win iff that effective
 * multiplier is below the crash point.
 */
export function settleCrash(
  claimedBp: number,
  elapsedMs: number,
  crashBp: number,
): { win: boolean; effectiveBp: number } {
  const serverBp = crashMultiplierAtMs(elapsedMs);
  const effectiveBp = Math.max(100, Math.min(claimedBp, serverBp));
  if (effectiveBp >= crashBp) return { win: false, effectiveBp: crashBp };
  return { win: true, effectiveBp };
}

/** Whole-bibcoin payout for cashing out at `bp` (floored). */
export function crashPayout(bet: number, bp: number): number {
  return Math.floor((bet * bp) / 100);
}
