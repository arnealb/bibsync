"use server";

import type { SupabaseClient } from "@supabase/supabase-js";

import { awardBibcoins, spendBibcoins } from "@/lib/bibcoins/award";
import { getBibcoins } from "@/lib/bibcoins/queries";
import { copy } from "@/lib/copy";
import {
  crashHasBusted,
  crashPayout,
  crashPointBp,
  settleCrash,
  type CrashRoundState,
} from "@/lib/crash/engine";
import { requireRoomAccess } from "@/lib/rooms/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  cashoutCrashSchema,
  startCrashSchema,
  type CashoutCrashInput,
  type StartCrashInput,
} from "@/lib/validation/crash";

export type CrashActionResult =
  | { ok: true; state: CrashRoundState; balance: number }
  | { ok: false; error: string };

function cryptoRng(): number {
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return buf[0] / 2 ** 32;
}

async function authorize(
  roomId: string,
): Promise<
  | { ok: true; userId: string; admin: SupabaseClient }
  | { ok: false; error: string }
> {
  const access = await requireRoomAccess(roomId);
  if (!access) return { ok: false, error: copy.common.notAuthenticated };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: copy.crash.unavailable };
  return { ok: true, userId: access.userId, admin };
}

interface RoundRow {
  bet: number;
  status: string;
  started_at: string;
  crash_bp: number | null;
  cashout_bp: number | null;
  payout: number;
  version: number;
}

async function loadRound(
  admin: SupabaseClient,
  roomId: string,
  userId: string,
): Promise<{ row: RoundRow; crashBp: number } | null> {
  const [round, priv] = await Promise.all([
    admin
      .from("crash_rounds")
      .select("bet, status, started_at, crash_bp, cashout_bp, payout, version")
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .maybeSingle(),
    admin
      .from("crash_private")
      .select("crash_bp")
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .maybeSingle(),
  ]);
  if (!round.data) return null;
  return {
    row: round.data as RoundRow,
    crashBp: (priv.data?.crash_bp as number | undefined) ?? 100,
  };
}

/** Public state for the client (never leaks the crash point while running). */
function toState(row: RoundRow): CrashRoundState {
  return {
    status: row.status as CrashRoundState["status"],
    bet: row.bet,
    startedAt: row.started_at,
    serverNow: new Date().toISOString(),
    crashBp: row.status === "running" ? null : row.crash_bp,
    cashoutBp: row.cashout_bp,
    payout: row.payout,
  };
}

/** Stake the bet and launch a rocket (overwrites any previous round). */
export async function startCrash(
  input: StartCrashInput,
): Promise<CrashActionResult> {
  const parsed = startCrashSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: copy.common.genericError };
  const { roomId, bet } = parsed.data;

  const auth = await authorize(roomId);
  if (!auth.ok) return auth;

  const balance = await getBibcoins(auth.userId);
  if (bet > balance) return { ok: false, error: copy.crash.cantAfford };

  const ref = `${roomId}:${auth.userId}:${crypto.randomUUID()}`;
  const paid = await spendBibcoins(auth.userId, bet, "crash_bet", ref);
  if (!paid) return { ok: false, error: copy.crash.cantAfford };

  const crashBp = crashPointBp(cryptoRng);
  const startedAt = new Date().toISOString();

  const [round, priv] = await Promise.all([
    auth.admin.from("crash_rounds").upsert(
      {
        room_id: roomId,
        user_id: auth.userId,
        bet,
        status: "running",
        started_at: startedAt,
        crash_bp: null,
        cashout_bp: null,
        payout: 0,
        version: 0,
        updated_at: startedAt,
      },
      { onConflict: "room_id,user_id" },
    ),
    auth.admin.from("crash_private").upsert(
      { room_id: roomId, user_id: auth.userId, crash_bp: crashBp },
      { onConflict: "room_id,user_id" },
    ),
  ]);
  if (round.error || priv.error) {
    console.error("[startCrash]", round.error ?? priv.error);
    await awardBibcoins(auth.userId, bet, "crash_refund", ref);
    return { ok: false, error: copy.crash.busy };
  }

  return {
    ok: true,
    state: {
      status: "running",
      bet,
      startedAt,
      serverNow: new Date().toISOString(),
      crashBp: null,
      cashoutBp: null,
      payout: 0,
    },
    balance: await getBibcoins(auth.userId),
  };
}

/** Settle a running round: bust it if it already crashed, else end it. */
async function endRound(
  admin: SupabaseClient,
  roomId: string,
  userId: string,
  loaded: { row: RoundRow; crashBp: number },
  outcome: { status: "cashed" | "busted"; cashoutBp: number | null; payout: number },
): Promise<boolean> {
  const updated = await admin
    .from("crash_rounds")
    .update({
      status: outcome.status,
      crash_bp: loaded.crashBp,
      cashout_bp: outcome.cashoutBp,
      payout: outcome.payout,
      version: loaded.row.version + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .eq("version", loaded.row.version)
    .select("room_id");
  if (updated.error) {
    console.error("[crash:endRound]", updated.error);
    return false;
  }
  return Boolean(updated.data && updated.data.length > 0);
}

/** Cash out the running round at the multiplier the client is showing. */
export async function cashoutCrash(
  input: CashoutCrashInput,
): Promise<CrashActionResult> {
  const parsed = cashoutCrashSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: copy.common.genericError };
  const { roomId, claimedBp } = parsed.data;

  const auth = await authorize(roomId);
  if (!auth.ok) return auth;

  const loaded = await loadRound(auth.admin, roomId, auth.userId);
  if (!loaded || loaded.row.status !== "running") {
    return { ok: false, error: copy.crash.noRound };
  }

  const elapsedMs = Date.now() - Date.parse(loaded.row.started_at);
  const { win, effectiveBp } = settleCrash(claimedBp, elapsedMs, loaded.crashBp);
  const payout = win ? crashPayout(loaded.row.bet, effectiveBp) : 0;

  const ok = await endRound(auth.admin, roomId, auth.userId, loaded, {
    status: win ? "cashed" : "busted",
    cashoutBp: win ? effectiveBp : null,
    payout,
  });
  if (!ok) return { ok: false, error: copy.crash.busy };

  if (payout > 0) {
    await awardBibcoins(
      auth.userId,
      payout,
      "crash_payout",
      `${roomId}:${auth.userId}:${loaded.row.started_at}`,
    );
  }

  return {
    ok: true,
    state: {
      status: win ? "cashed" : "busted",
      bet: loaded.row.bet,
      startedAt: loaded.row.started_at,
      serverNow: new Date().toISOString(),
      crashBp: loaded.crashBp,
      cashoutBp: win ? effectiveBp : null,
      payout,
    },
    balance: await getBibcoins(auth.userId),
  };
}

/** Poll: if the running round has already crashed, bust it. Idempotent. */
export async function peekCrash(roomId: string): Promise<CrashActionResult> {
  const auth = await authorize(roomId);
  if (!auth.ok) return auth;

  const loaded = await loadRound(auth.admin, roomId, auth.userId);
  if (!loaded) return { ok: false, error: copy.crash.noRound };
  if (loaded.row.status !== "running") {
    return {
      ok: true,
      state: toState(loaded.row),
      balance: await getBibcoins(auth.userId),
    };
  }

  const elapsedMs = Date.now() - Date.parse(loaded.row.started_at);
  if (!crashHasBusted(elapsedMs, loaded.crashBp)) {
    return {
      ok: true,
      state: toState(loaded.row),
      balance: await getBibcoins(auth.userId),
    };
  }

  await endRound(auth.admin, roomId, auth.userId, loaded, {
    status: "busted",
    cashoutBp: null,
    payout: 0,
  });
  return {
    ok: true,
    state: {
      status: "busted",
      bet: loaded.row.bet,
      startedAt: loaded.row.started_at,
      serverNow: new Date().toISOString(),
      crashBp: loaded.crashBp,
      cashoutBp: null,
      payout: 0,
    },
    balance: await getBibcoins(auth.userId),
  };
}
