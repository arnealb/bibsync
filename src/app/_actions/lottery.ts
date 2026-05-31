"use server";

import type { SupabaseClient } from "@supabase/supabase-js";

import { awardBibcoins, spendBibcoins } from "@/lib/bibcoins/award";
import { getBibcoins } from "@/lib/bibcoins/queries";
import { copy } from "@/lib/copy";
import { LOTTERY_TICKET_PRICE } from "@/lib/lottery/config";
import {
  addTickets,
  initialLottery,
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

/** Buy lottery tickets for the current round (drawn daily by the cron). */
export async function buyTickets(
  input: BuyTicketsInput,
): Promise<LotteryActionResult> {
  const parsed = buyTicketsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: copy.common.genericError };
  const { roomId, count } = parsed.data;

  const auth = await authorize(roomId);
  if (!auth.ok) return auth;

  const loaded = await loadOrCreate(auth.admin, roomId);

  const cost = count * LOTTERY_TICKET_PRICE;
  if ((await getBibcoins(auth.userId)) < cost) {
    return { ok: false, error: copy.lottery.cantAfford };
  }

  const ref = `lottery:${roomId}:${loaded.state.roundNo}:${auth.userId}:${crypto.randomUUID()}`;
  const paid = await spendBibcoins(auth.userId, cost, "lottery_ticket", ref);
  if (!paid) return { ok: false, error: copy.lottery.cantAfford };

  const next = addTickets(loaded.state, auth.userId, count, LOTTERY_TICKET_PRICE);
  const ok = await persist(auth.admin, roomId, loaded.version, next);
  if (!ok) {
    await awardBibcoins(auth.userId, cost, "lottery_refund", ref);
    return { ok: false, error: copy.lottery.busy };
  }
  return { ok: true, balance: await getBibcoins(auth.userId) };
}
