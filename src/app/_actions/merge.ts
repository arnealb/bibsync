"use server";

import type { SupabaseClient } from "@supabase/supabase-js";

import { awardBibcoins, spendBibcoins } from "@/lib/bibcoins/award";
import { earnFromMergeOrder } from "@/lib/bibcoins/earn";
import { getBibcoins } from "@/lib/bibcoins/queries";
import { copy } from "@/lib/copy";
import { ENERGY_REFILL_AMOUNT, ENERGY_REFILL_COST } from "@/lib/merge/config";
import {
  addEnergy,
  createBoard,
  fulfillOrder,
  moveOrMerge,
  regenEnergy,
  tapGenerator,
} from "@/lib/merge/engine";
import type { MergeError, MergeState } from "@/lib/merge/types";
import { requireRoomAccess } from "@/lib/rooms/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  mergeBuyEnergySchema,
  mergeMoveSchema,
  mergeOrderSchema,
  mergeRoomSchema,
  mergeTapSchema,
} from "@/lib/validation/merge";

export type MergeActionResult =
  | { ok: true; state: MergeState; balance: number; awarded?: number }
  | { ok: false; error: string };

/** Uniform [0,1) from the CSPRNG — drives spawns and order generation. */
function cryptoRng(): number {
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return buf[0] / 2 ** 32;
}

/** Map an engine error to a friendly Dutch message. */
function errorMessage(reason: MergeError | "no-item"): string {
  switch (reason) {
    case "no-energy":
      return copy.merge.noEnergy;
    case "board-full":
      return copy.merge.boardFull;
    case "no-item":
      return copy.merge.noItem;
    default:
      return copy.common.genericError;
  }
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
  if (!admin) return { ok: false, error: copy.merge.unavailable };
  return { ok: true, userId: access.userId, admin };
}

async function load(
  admin: SupabaseClient,
  roomId: string,
  userId: string,
): Promise<{ state: MergeState; version: number } | null> {
  const { data } = await admin
    .from("merge_games")
    .select("state, version")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return null;
  return { state: data.state as unknown as MergeState, version: data.version };
}

/** Optimistic version guard — a lost race returns false and advances nothing. */
async function persist(
  admin: SupabaseClient,
  roomId: string,
  userId: string,
  oldVersion: number,
  state: MergeState,
): Promise<boolean> {
  const updated = await admin
    .from("merge_games")
    .update({ state, version: oldVersion + 1, updated_at: new Date().toISOString() })
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .eq("version", oldVersion)
    .select("room_id");
  if (updated.error) {
    console.error("[merge:persist]", updated.error);
    return false;
  }
  return Boolean(updated.data && updated.data.length > 0);
}

/** Load (creating on first visit) and reconcile free energy regeneration. */
export async function getMergeBoard(input: {
  roomId: string;
}): Promise<MergeActionResult> {
  const parsed = mergeRoomSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: copy.common.genericError };
  const auth = await authorize(parsed.data.roomId);
  if (!auth.ok) return auth;
  const { roomId } = parsed.data;

  const existing = await load(auth.admin, roomId, auth.userId);
  if (!existing) {
    const state = createBoard(cryptoRng, new Date().toISOString());
    const { error } = await auth.admin.from("merge_games").upsert(
      { room_id: roomId, user_id: auth.userId, state, version: 0 },
      { onConflict: "room_id,user_id" },
    );
    if (error) {
      console.error("[getMergeBoard]", error);
      return { ok: false, error: copy.merge.unavailable };
    }
    return { ok: true, state, balance: await getBibcoins(auth.userId) };
  }

  const regen = regenEnergy(existing.state, Date.now());
  // Best-effort persist of regen; the returned state is correct regardless.
  await persist(auth.admin, roomId, auth.userId, existing.version, regen);
  return { ok: true, state: regen, balance: await getBibcoins(auth.userId) };
}

/** Shared load → regen → mutate → persist pipeline for the mutating actions. */
async function mutate(
  roomId: string,
  apply: (state: MergeState) => { state: MergeState } | { error: string },
): Promise<MergeActionResult> {
  const auth = await authorize(roomId);
  if (!auth.ok) return auth;

  const loaded = await load(auth.admin, roomId, auth.userId);
  if (!loaded) return { ok: false, error: copy.merge.noGame };

  const regen = regenEnergy(loaded.state, Date.now());
  const result = apply(regen);
  if ("error" in result) return { ok: false, error: result.error };

  const ok = await persist(auth.admin, roomId, auth.userId, loaded.version, result.state);
  if (!ok) return { ok: false, error: copy.merge.busy };
  return { ok: true, state: result.state, balance: await getBibcoins(auth.userId) };
}

/** Tap the generator: spend energy, spawn a tier-1 item. */
export async function mergeTap(input: { roomId: string }): Promise<MergeActionResult> {
  const parsed = mergeTapSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: copy.common.genericError };
  return mutate(parsed.data.roomId, (state) => {
    const op = tapGenerator(state, cryptoRng);
    return op.ok ? { state: op.state } : { error: errorMessage(op.reason) };
  });
}

/** Move an item onto an empty cell, or merge it into an identical one. */
export async function mergeMove(input: {
  roomId: string;
  from: number;
  to: number;
}): Promise<MergeActionResult> {
  const parsed = mergeMoveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: copy.common.genericError };
  const { roomId, from, to } = parsed.data;
  return mutate(roomId, (state) => {
    const op = moveOrMerge(state, from, to);
    return op.ok ? { state: op.state } : { error: errorMessage(op.reason) };
  });
}

/** Deliver an order: consume the matching item, pay the (capped) reward. */
export async function mergeFulfill(input: {
  roomId: string;
  orderId: string;
}): Promise<MergeActionResult> {
  const parsed = mergeOrderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: copy.common.genericError };
  const { roomId, orderId } = parsed.data;

  const auth = await authorize(roomId);
  if (!auth.ok) return auth;

  const loaded = await load(auth.admin, roomId, auth.userId);
  if (!loaded) return { ok: false, error: copy.merge.noGame };

  const regen = regenEnergy(loaded.state, Date.now());
  const op = fulfillOrder(regen, orderId, cryptoRng);
  if (!op.ok) return { ok: false, error: errorMessage(op.reason) };

  // Persist (consume the item) before paying, so a lost race can't double-pay.
  const ok = await persist(auth.admin, roomId, auth.userId, loaded.version, op.state);
  if (!ok) return { ok: false, error: copy.merge.busy };

  const awarded = await earnFromMergeOrder(
    auth.userId,
    op.reward,
    `merge-order:${roomId}:${auth.userId}:${orderId}`,
  );
  return { ok: true, state: op.state, balance: await getBibcoins(auth.userId), awarded };
}

/** Buy an energy refill with bibcoins (the coin sink). */
export async function mergeBuyEnergy(input: {
  roomId: string;
}): Promise<MergeActionResult> {
  const parsed = mergeBuyEnergySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: copy.common.genericError };
  const { roomId } = parsed.data;

  const auth = await authorize(roomId);
  if (!auth.ok) return auth;

  const loaded = await load(auth.admin, roomId, auth.userId);
  if (!loaded) return { ok: false, error: copy.merge.noGame };

  const balance = await getBibcoins(auth.userId);
  if (balance < ENERGY_REFILL_COST) return { ok: false, error: copy.merge.cantAfford };

  const ref = `merge-energy:${roomId}:${auth.userId}:${crypto.randomUUID()}`;
  const paid = await spendBibcoins(auth.userId, ENERGY_REFILL_COST, "merge_energy", ref);
  if (!paid) return { ok: false, error: copy.merge.cantAfford };

  const regen = regenEnergy(loaded.state, Date.now());
  const next = addEnergy(regen, ENERGY_REFILL_AMOUNT);
  const ok = await persist(auth.admin, roomId, auth.userId, loaded.version, next);
  if (!ok) {
    await awardBibcoins(auth.userId, ENERGY_REFILL_COST, "merge_energy_refund", ref);
    return { ok: false, error: copy.merge.busy };
  }
  return { ok: true, state: next, balance: await getBibcoins(auth.userId) };
}
