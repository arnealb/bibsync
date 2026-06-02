"use server";

import type { SupabaseClient } from "@supabase/supabase-js";

import { awardBibcoins, spendBibcoins } from "@/lib/bibcoins/award";
import { getBibcoins } from "@/lib/bibcoins/queries";
import { copy } from "@/lib/copy";
import {
  drawCard,
  guessWins,
  hiloPayout,
  optionMultiplier,
  winCount,
  type HiloState,
} from "@/lib/hilo/engine";
import { requireRoomAccess } from "@/lib/rooms/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  guessHiloSchema,
  startHiloSchema,
  type GuessHiloInput,
  type StartHiloInput,
} from "@/lib/validation/hilo";

export type HiloActionResult =
  | { ok: true; state: HiloState; balance: number }
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
  if (access.isPilloried) return { ok: false, error: copy.pillory.frozen };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: copy.hilo.unavailable };
  return { ok: true, userId: access.userId, admin };
}

interface Loaded {
  state: HiloState;
  version: number;
  next: number;
}

async function loadGame(
  admin: SupabaseClient,
  roomId: string,
  userId: string,
): Promise<Loaded | null> {
  const [game, priv] = await Promise.all([
    admin
      .from("hilo_games")
      .select("state, version")
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .maybeSingle(),
    admin
      .from("hilo_private")
      .select("next")
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .maybeSingle(),
  ]);
  if (!game.data) return null;
  return {
    state: game.data.state as unknown as HiloState,
    version: game.data.version,
    next: (priv.data?.next as number | undefined) ?? 0,
  };
}

async function persist(
  admin: SupabaseClient,
  roomId: string,
  userId: string,
  oldVersion: number,
  state: HiloState,
): Promise<boolean> {
  const updated = await admin
    .from("hilo_games")
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
    console.error("[hilo:persist]", updated.error);
    return false;
  }
  return Boolean(updated.data && updated.data.length > 0);
}

/** Stake the bet and deal the first card. */
export async function startHilo(
  input: StartHiloInput,
): Promise<HiloActionResult> {
  const parsed = startHiloSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: copy.common.genericError };
  const { roomId, bet } = parsed.data;

  const auth = await authorize(roomId);
  if (!auth.ok) return auth;

  const existing = await loadGame(auth.admin, roomId, auth.userId);
  if (existing && existing.state.status === "active") {
    return { ok: false, error: copy.hilo.finishFirst };
  }

  if ((await getBibcoins(auth.userId)) < bet) {
    return { ok: false, error: copy.hilo.cantAfford };
  }

  const gameId = crypto.randomUUID();
  const ref = `${roomId}:${auth.userId}:${gameId}`;
  const paid = await spendBibcoins(auth.userId, bet, "hilo_bet", ref);
  if (!paid) return { ok: false, error: copy.hilo.cantAfford };

  const current = drawCard(cryptoRng);
  const next = drawCard(cryptoRng);
  const state: HiloState = {
    id: gameId,
    status: "active",
    bet,
    current,
    multiplier: 1,
    streak: 0,
    revealed: null,
    payout: 0,
  };

  const [game, priv] = await Promise.all([
    auth.admin.from("hilo_games").upsert(
      {
        room_id: roomId,
        user_id: auth.userId,
        state,
        version: 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "room_id,user_id" },
    ),
    auth.admin.from("hilo_private").upsert(
      { room_id: roomId, user_id: auth.userId, next },
      { onConflict: "room_id,user_id" },
    ),
  ]);
  if (game.error || priv.error) {
    console.error("[startHilo]", game.error ?? priv.error);
    await awardBibcoins(auth.userId, bet, "hilo_refund", ref);
    return { ok: false, error: copy.hilo.busy };
  }

  return { ok: true, state, balance: await getBibcoins(auth.userId) };
}

/** Guess higher/lower; a correct guess bumps the multiplier, a wrong one busts. */
export async function guessHilo(
  input: GuessHiloInput,
): Promise<HiloActionResult> {
  const parsed = guessHiloSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: copy.common.genericError };
  const { roomId, direction } = parsed.data;

  const auth = await authorize(roomId);
  if (!auth.ok) return auth;

  const loaded = await loadGame(auth.admin, roomId, auth.userId);
  if (!loaded || loaded.state.status !== "active") {
    return { ok: false, error: copy.hilo.noGame };
  }
  const { state, version, next } = loaded;
  if (winCount(direction, state.current) <= 0) {
    return { ok: false, error: copy.common.genericError };
  }

  if (guessWins(direction, state.current, next)) {
    const newNext = drawCard(cryptoRng);
    const won: HiloState = {
      ...state,
      current: next,
      multiplier: state.multiplier * optionMultiplier(direction, state.current),
      streak: state.streak + 1,
    };
    const ok = await persist(auth.admin, roomId, auth.userId, version, won);
    if (!ok) return { ok: false, error: copy.hilo.busy };
    await auth.admin
      .from("hilo_private")
      .update({ next: newNext })
      .eq("room_id", roomId)
      .eq("user_id", auth.userId);
    return { ok: true, state: won, balance: await getBibcoins(auth.userId) };
  }

  const busted: HiloState = { ...state, status: "busted", revealed: next };
  const ok = await persist(auth.admin, roomId, auth.userId, version, busted);
  if (!ok) return { ok: false, error: copy.hilo.busy };
  return { ok: true, state: busted, balance: await getBibcoins(auth.userId) };
}

/** Bank the running multiplier and end the game. */
export async function cashoutHilo(roomId: string): Promise<HiloActionResult> {
  const auth = await authorize(roomId);
  if (!auth.ok) return auth;

  const loaded = await loadGame(auth.admin, roomId, auth.userId);
  if (!loaded || loaded.state.status !== "active") {
    return { ok: false, error: copy.hilo.noGame };
  }
  if (loaded.state.streak === 0) {
    return { ok: false, error: copy.hilo.guessFirst };
  }

  const { state, version } = loaded;
  const payout = hiloPayout(state.bet, state.multiplier);
  const next: HiloState = { ...state, status: "cashed", payout };
  const ok = await persist(auth.admin, roomId, auth.userId, version, next);
  if (!ok) return { ok: false, error: copy.hilo.busy };

  await awardBibcoins(auth.userId, payout, "hilo_payout", `hilo:${state.id}:cashout`);
  return { ok: true, state: next, balance: await getBibcoins(auth.userId) };
}
