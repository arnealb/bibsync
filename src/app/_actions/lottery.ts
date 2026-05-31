"use server";

import type { SupabaseClient } from "@supabase/supabase-js";

import { awardBibcoins, spendBibcoins } from "@/lib/bibcoins/award";
import { getBibcoins } from "@/lib/bibcoins/queries";
import { copy } from "@/lib/copy";
import { LOTTERY_TICKET_PRICE } from "@/lib/lottery/config";
import {
  addTickets,
  canDraw,
  initialLottery,
  resolveLottery,
  startRound,
  ticketsFor,
  type LotteryState,
} from "@/lib/lottery/engine";
import { requireRoomAccess } from "@/lib/rooms/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buyTicketsSchema,
  type BuyTicketsInput,
} from "@/lib/validation/lottery";

export type LotteryActionResult =
  | { ok: true; balance?: number }
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
  if (!admin) return { ok: false, error: copy.lottery.unavailable };
  return { ok: true, userId: access.userId, admin };
}

async function loadOrCreate(
  admin: SupabaseClient,
  roomId: string,
): Promise<{ state: LotteryState; version: number }> {
  const existing = await admin
    .from("lottery_rounds")
    .select("state, version")
    .eq("room_id", roomId)
    .maybeSingle();

  if (!existing.data) {
    await admin.from("lottery_rounds").upsert(
      { room_id: roomId, state: initialLottery(), version: 0 },
      { onConflict: "room_id", ignoreDuplicates: true },
    );
    return loadOrCreate(admin, roomId);
  }
  return {
    state: existing.data.state as unknown as LotteryState,
    version: existing.data.version,
  };
}

async function persist(
  admin: SupabaseClient,
  roomId: string,
  oldVersion: number,
  state: LotteryState,
): Promise<boolean> {
  const updated = await admin
    .from("lottery_rounds")
    .update({
      state,
      version: oldVersion + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("room_id", roomId)
    .eq("version", oldVersion)
    .select("room_id");
  if (updated.error) {
    console.error("[lottery:persist]", updated.error);
    return false;
  }
  return Boolean(updated.data && updated.data.length > 0);
}

/** Buy lottery tickets; opens the countdown once enough players have joined. */
export async function buyTickets(
  input: BuyTicketsInput,
): Promise<LotteryActionResult> {
  const parsed = buyTicketsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: copy.common.genericError };
  const { roomId, count } = parsed.data;

  const auth = await authorize(roomId);
  if (!auth.ok) return auth;

  const loaded = await loadOrCreate(auth.admin, roomId);
  if (loaded.state.phase !== "open") {
    return { ok: false, error: copy.lottery.closed };
  }

  const cost = count * LOTTERY_TICKET_PRICE;
  if ((await getBibcoins(auth.userId)) < cost) {
    return { ok: false, error: copy.lottery.cantAfford };
  }

  const ref = `lottery:${roomId}:${loaded.state.roundNo}:${auth.userId}:${crypto.randomUUID()}`;
  const paid = await spendBibcoins(auth.userId, cost, "lottery_ticket", ref);
  if (!paid) return { ok: false, error: copy.lottery.cantAfford };

  const next = addTickets(
    loaded.state,
    auth.userId,
    count,
    LOTTERY_TICKET_PRICE,
    new Date().toISOString(),
  );
  const ok = await persist(auth.admin, roomId, loaded.version, next);
  if (!ok) {
    await awardBibcoins(auth.userId, cost, "lottery_refund", ref);
    return { ok: false, error: copy.lottery.busy };
  }
  return { ok: true, balance: await getBibcoins(auth.userId) };
}

/** Pick the winner and pay the pot. Version-guarded, so only one caller draws. */
async function drawAndPay(
  admin: SupabaseClient,
  roomId: string,
  state: LotteryState,
  version: number,
): Promise<void> {
  const next = resolveLottery(state, cryptoRng, new Date().toISOString());
  const ok = await persist(admin, roomId, version, next);
  if (!ok) return; // another client drew it first

  if (next.winnerId && next.prize > 0) {
    await awardBibcoins(
      next.winnerId,
      next.prize,
      "lottery_prize",
      `${roomId}:${next.roundNo}`,
    );
  }
}

/** Draw once the countdown is up. Idempotent; safe to call from any client. */
export async function drawLottery(roomId: string): Promise<LotteryActionResult> {
  const auth = await authorize(roomId);
  if (!auth.ok) return auth;

  const { state, version } = await loadOrCreate(auth.admin, roomId);
  if (!canDraw(state) || !state.endsAt) return { ok: true };
  if (Date.now() < Date.parse(state.endsAt)) return { ok: true };

  await drawAndPay(auth.admin, roomId, state, version);
  return { ok: true };
}

/** Draw immediately, skipping the countdown. Any participant may trigger it. */
export async function drawLotteryNow(
  roomId: string,
): Promise<LotteryActionResult> {
  const auth = await authorize(roomId);
  if (!auth.ok) return auth;

  const { state, version } = await loadOrCreate(auth.admin, roomId);
  if (!canDraw(state)) return { ok: false, error: copy.lottery.needPlayers };
  if (ticketsFor(state, auth.userId) <= 0) {
    return { ok: false, error: copy.lottery.needTicket };
  }

  await drawAndPay(auth.admin, roomId, state, version);
  return { ok: true };
}

/** Open the next round after a draw. Idempotent across clients. */
export async function startLotteryRound(
  roomId: string,
): Promise<LotteryActionResult> {
  const auth = await authorize(roomId);
  if (!auth.ok) return auth;

  const { state, version } = await loadOrCreate(auth.admin, roomId);
  if (state.phase !== "drawn") return { ok: true };

  await persist(auth.admin, roomId, version, startRound(state));
  return { ok: true };
}
