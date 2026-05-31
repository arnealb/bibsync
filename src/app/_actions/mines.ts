"use server";

import type { SupabaseClient } from "@supabase/supabase-js";

import { awardBibcoins, spendBibcoins } from "@/lib/bibcoins/award";
import { getBibcoins } from "@/lib/bibcoins/queries";
import { copy } from "@/lib/copy";
import {
  generateMines,
  minesMultiplier,
  minesPayout,
  safeTileCount,
  type MinesState,
} from "@/lib/mines/engine";
import { requireRoomAccess } from "@/lib/rooms/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  cashoutMinesSchema,
  revealMinesSchema,
  startMinesSchema,
  type CashoutMinesInput,
  type RevealMinesInput,
  type StartMinesInput,
} from "@/lib/validation/mines";

export type MinesActionResult =
  | { ok: true; state: MinesState; balance: number }
  | { ok: false; error: string };

/** Uniform [0,1) from the CSPRNG — used to place the bombs server-side. */
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
  if (!admin) return { ok: false, error: copy.mines.unavailable };
  return { ok: true, userId: access.userId, admin };
}

interface Loaded {
  state: MinesState;
  version: number;
  mines: number[];
}

/** Load the player's public game state plus the hidden bomb positions. */
async function loadGame(
  admin: SupabaseClient,
  roomId: string,
  userId: string,
): Promise<Loaded | null> {
  const [game, priv] = await Promise.all([
    admin
      .from("mines_games")
      .select("state, version")
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .maybeSingle(),
    admin
      .from("mines_private")
      .select("mines")
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  if (!game.data) return null;
  return {
    state: game.data.state as unknown as MinesState,
    version: game.data.version,
    mines: (priv.data?.mines as number[] | undefined) ?? [],
  };
}

/** Optimistic version guard — a lost race returns false and advances nothing. */
async function persist(
  admin: SupabaseClient,
  roomId: string,
  userId: string,
  oldVersion: number,
  state: MinesState,
): Promise<boolean> {
  const updated = await admin
    .from("mines_games")
    .update({
      state,
      version: oldVersion + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .eq("version", oldVersion)
    .select("room_id");

  if (updated.error) {
    console.error("[mines:persist]", updated.error);
    return false;
  }
  return Boolean(updated.data && updated.data.length > 0);
}

/** Stake bibcoins and deal a fresh board. */
export async function startMines(
  input: StartMinesInput,
): Promise<MinesActionResult> {
  const parsed = startMinesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: copy.common.genericError };
  const { roomId, bet, mineCount } = parsed.data;

  const auth = await authorize(roomId);
  if (!auth.ok) return auth;

  const existing = await loadGame(auth.admin, roomId, auth.userId);
  if (existing && existing.state.status === "active") {
    return { ok: false, error: copy.mines.finishFirst };
  }

  const balance = await getBibcoins(auth.userId);
  if (bet > balance) return { ok: false, error: copy.mines.cantAfford };

  const ref = `${roomId}:${auth.userId}:${crypto.randomUUID()}`;
  const paid = await spendBibcoins(auth.userId, bet, "mines_bet", ref);
  if (!paid) return { ok: false, error: copy.mines.cantAfford };

  const mines = generateMines(mineCount, cryptoRng);
  const state: MinesState = {
    status: "active",
    bet,
    mineCount,
    revealed: [],
    mines: null,
    bust: null,
    multiplier: 1,
    payout: 0,
  };

  // Overwrite any finished game; version resets to 0 for the new game.
  const [game, priv] = await Promise.all([
    auth.admin.from("mines_games").upsert(
      {
        room_id: roomId,
        user_id: auth.userId,
        state,
        version: 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "room_id,user_id" },
    ),
    auth.admin.from("mines_private").upsert(
      { room_id: roomId, user_id: auth.userId, mines },
      { onConflict: "room_id,user_id" },
    ),
  ]);

  if (game.error || priv.error) {
    console.error("[startMines]", game.error ?? priv.error);
    await awardBibcoins(auth.userId, bet, "mines_refund", ref);
    return { ok: false, error: copy.mines.busy };
  }

  return { ok: true, state, balance: await getBibcoins(auth.userId) };
}

/** Open one tile: a bomb ends the game, a safe tile bumps the multiplier. */
export async function revealMinesTile(
  input: RevealMinesInput,
): Promise<MinesActionResult> {
  const parsed = revealMinesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: copy.common.genericError };
  const { roomId, tile } = parsed.data;

  const auth = await authorize(roomId);
  if (!auth.ok) return auth;

  const loaded = await loadGame(auth.admin, roomId, auth.userId);
  if (!loaded || loaded.state.status !== "active") {
    return { ok: false, error: copy.mines.noGame };
  }
  if (loaded.state.revealed.includes(tile)) {
    return { ok: false, error: copy.common.genericError };
  }

  const { state, version, mines } = loaded;

  // Hit a bomb — game over, stake already lost.
  if (mines.includes(tile)) {
    const next: MinesState = {
      ...state,
      status: "busted",
      mines,
      bust: tile,
      multiplier: minesMultiplier(state.mineCount, state.revealed.length),
      payout: 0,
    };
    const ok = await persist(auth.admin, roomId, auth.userId, version, next);
    if (!ok) return { ok: false, error: copy.mines.busy };
    return { ok: true, state: next, balance: await getBibcoins(auth.userId) };
  }

  const revealed = [...state.revealed, tile];
  const multiplier = minesMultiplier(state.mineCount, revealed.length);

  // Cleared every safe tile → auto cash-out at the maximum.
  if (revealed.length >= safeTileCount(state.mineCount)) {
    return cashOut(auth.admin, roomId, auth.userId, {
      ...state,
      revealed,
      multiplier,
    }, version, mines);
  }

  const next: MinesState = { ...state, revealed, multiplier };
  const ok = await persist(auth.admin, roomId, auth.userId, version, next);
  if (!ok) return { ok: false, error: copy.mines.busy };
  return { ok: true, state: next, balance: await getBibcoins(auth.userId) };
}

/** Bank the current multiplier and end the game. */
export async function cashoutMines(
  input: CashoutMinesInput,
): Promise<MinesActionResult> {
  const parsed = cashoutMinesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: copy.common.genericError };
  const { roomId } = parsed.data;

  const auth = await authorize(roomId);
  if (!auth.ok) return auth;

  const loaded = await loadGame(auth.admin, roomId, auth.userId);
  if (!loaded || loaded.state.status !== "active") {
    return { ok: false, error: copy.mines.noGame };
  }
  if (loaded.state.revealed.length === 0) {
    return { ok: false, error: copy.mines.revealFirst };
  }

  return cashOut(
    auth.admin,
    roomId,
    auth.userId,
    loaded.state,
    loaded.version,
    loaded.mines,
  );
}

/** Shared settle path for manual cash-out and the all-clear auto cash-out. */
async function cashOut(
  admin: SupabaseClient,
  roomId: string,
  userId: string,
  state: MinesState,
  version: number,
  mines: number[],
): Promise<MinesActionResult> {
  const payout = minesPayout(state.bet, state.mineCount, state.revealed.length);
  const next: MinesState = {
    ...state,
    status: "cashed",
    mines,
    multiplier: minesMultiplier(state.mineCount, state.revealed.length),
    payout,
  };

  const ok = await persist(admin, roomId, userId, version, next);
  if (!ok) return { ok: false, error: copy.mines.busy };

  // Version is unique per transition, so award_bibcoins stays idempotent.
  await awardBibcoins(
    userId,
    payout,
    "mines_payout",
    `${roomId}:${userId}:cashout:${version}`,
  );
  return { ok: true, state: next, balance: await getBibcoins(userId) };
}
