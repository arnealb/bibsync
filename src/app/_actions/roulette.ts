"use server";

import type { SupabaseClient } from "@supabase/supabase-js";

import { awardBibcoins, spendBibcoins } from "@/lib/bibcoins/award";
import { getBibcoins } from "@/lib/bibcoins/queries";
import { unlockAchievement } from "@/lib/bibcoins/unlock";
import { copy } from "@/lib/copy";
import { ROULETTE_BETTING_MS, ROULETTE_MAX_BETS } from "@/lib/roulette/config";
import { pickNumber } from "@/lib/roulette/engine";
import {
  addBet,
  initialRouletteTable,
  resolveRound,
  startBetting,
  type RouletteTable,
} from "@/lib/roulette/table";
import { requireRoomAccess } from "@/lib/rooms/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  placeRouletteBetSchema,
  type PlaceRouletteBetInput,
} from "@/lib/validation/roulette";

export type RouletteActionResult =
  | { ok: true; balance?: number }
  | { ok: false; error: string };

function cryptoRng(): number {
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return buf[0] / 2 ** 32;
}

interface Loaded {
  state: RouletteTable;
  version: number;
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
  if (!admin) return { ok: false, error: copy.roulette.unavailable };
  return { ok: true, userId: access.userId, admin };
}

async function loadOrCreate(
  admin: SupabaseClient,
  roomId: string,
): Promise<Loaded> {
  const existing = await admin
    .from("roulette_tables")
    .select("state, version")
    .eq("room_id", roomId)
    .maybeSingle();

  if (!existing.data) {
    const fresh = initialRouletteTable();
    await admin
      .from("roulette_tables")
      .upsert(
        { room_id: roomId, state: fresh, version: 0 },
        { onConflict: "room_id", ignoreDuplicates: true },
      );
    return loadOrCreate(admin, roomId);
  }

  return {
    state: existing.data.state as unknown as RouletteTable,
    version: existing.data.version,
  };
}

async function persist(
  admin: SupabaseClient,
  roomId: string,
  oldVersion: number,
  state: RouletteTable,
): Promise<boolean> {
  const newVersion = oldVersion + 1;
  const updated = await admin
    .from("roulette_tables")
    .update({
      state: { ...state, version: newVersion },
      version: newVersion,
      updated_at: new Date().toISOString(),
    })
    .eq("room_id", roomId)
    .eq("version", oldVersion)
    .select("room_id");

  if (updated.error) {
    console.error("[roulette:persist]", updated.error);
    return false;
  }
  return Boolean(updated.data && updated.data.length > 0);
}

/** Place one chip-stack on a spot; opens the betting timer on the first bet. */
export async function placeRouletteBet(
  input: PlaceRouletteBetInput,
): Promise<RouletteActionResult> {
  const parsed = placeRouletteBetSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: copy.common.genericError };

  const auth = await authorize(parsed.data.roomId);
  if (!auth.ok) return auth;

  const loaded = await loadOrCreate(auth.admin, parsed.data.roomId);
  if (loaded.state.phase !== "betting") {
    return { ok: false, error: copy.roulette.betsLocked };
  }
  if (loaded.state.bets.length >= ROULETTE_MAX_BETS) {
    return { ok: false, error: copy.roulette.tableFull };
  }

  const balance = await getBibcoins(auth.userId);
  if (parsed.data.bet.amount > balance) {
    return { ok: false, error: copy.roulette.cantAfford };
  }

  const ref = `${parsed.data.roomId}:${loaded.state.roundNo}:${auth.userId}:${crypto.randomUUID()}`;
  const paid = await spendBibcoins(
    auth.userId,
    parsed.data.bet.amount,
    "roulette_bet",
    ref,
  );
  if (!paid) return { ok: false, error: copy.roulette.cantAfford };

  let next = addBet(loaded.state, auth.userId, parsed.data.bet);
  if (!next.bettingEndsAt) {
    next = {
      ...next,
      bettingEndsAt: new Date(Date.now() + ROULETTE_BETTING_MS).toISOString(),
    };
  }

  const ok = await persist(auth.admin, parsed.data.roomId, loaded.version, next);
  if (!ok) {
    await awardBibcoins(auth.userId, parsed.data.bet.amount, "roulette_refund", ref);
    return { ok: false, error: copy.roulette.busy };
  }
  return { ok: true, balance: await getBibcoins(auth.userId) };
}

/**
 * Resolve the round once the timer is up. Idempotent and safe to call from
 * every client (only the first to flip the version actually spins + pays out).
 */
export async function resolveRoulette(
  roomId: string,
): Promise<RouletteActionResult> {
  const auth = await authorize(roomId);
  if (!auth.ok) return auth;

  const loaded = await loadOrCreate(auth.admin, roomId);
  const { state, version } = loaded;
  if (state.phase !== "betting" || !state.bettingEndsAt) return { ok: true };
  if (Date.now() < Date.parse(state.bettingEndsAt)) return { ok: true };

  const number = pickNumber(cryptoRng);
  const next = resolveRound(state, number);

  const ok = await persist(auth.admin, roomId, version, next);
  if (!ok) return { ok: true }; // another client resolved it first

  for (const result of next.results ?? []) {
    if (result.payout > 0) {
      await awardBibcoins(
        result.userId,
        result.payout,
        "roulette_payout",
        `${roomId}:${next.roundNo}:${result.userId}`,
      );
      await unlockAchievement(result.userId, "roulette_win");
    }
  }
  return { ok: true };
}

/** Open a new betting round after a result. Idempotent across clients. */
export async function startRouletteRound(
  roomId: string,
): Promise<RouletteActionResult> {
  const auth = await authorize(roomId);
  if (!auth.ok) return auth;

  const loaded = await loadOrCreate(auth.admin, roomId);
  if (loaded.state.phase !== "result") return { ok: true };

  await persist(auth.admin, roomId, loaded.version, startBetting(loaded.state));
  return { ok: true };
}
