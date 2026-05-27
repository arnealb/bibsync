"use server";

import type { SupabaseClient } from "@supabase/supabase-js";

import { awardBibcoins, spendBibcoins } from "@/lib/bibcoins/award";
import { getBibcoins } from "@/lib/bibcoins/queries";
import { unlockAchievement } from "@/lib/bibcoins/unlock";
import {
  addSeat,
  applyAction,
  deal as engineDeal,
  initialTable,
  placeBet,
  removeSeat,
  seatPayout,
  startBetting,
  toPublicTable,
  type SeatActionKind,
  type TableState,
} from "@/lib/blackjack/table";
import { copy } from "@/lib/copy";
import { makeDeck, shuffle } from "@/lib/poker/cards";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRoomAccess } from "@/lib/rooms/queries";
import {
  placeBlackjackBetSchema,
  playBlackjackSchema,
  type PlaceBlackjackBetInput,
  type PlayBlackjackInput,
} from "@/lib/validation/blackjack";

export type BlackjackActionResult =
  | { ok: true; balance?: number }
  | { ok: false; error: string };

function cryptoRng(): () => number {
  return () => {
    const buf = new Uint32Array(1);
    globalThis.crypto.getRandomValues(buf);
    return buf[0] / 2 ** 32;
  };
}

interface Loaded {
  full: TableState;
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
  if (!admin) return { ok: false, error: copy.blackjack.unavailable };
  return { ok: true, userId: access.userId, admin };
}

/** Reads the full server-side state, creating an empty table if needed. */
async function loadOrCreate(
  admin: SupabaseClient,
  roomId: string,
): Promise<Loaded> {
  const existing = await admin
    .from("blackjack_tables")
    .select("version")
    .eq("room_id", roomId)
    .maybeSingle();

  if (!existing.data) {
    const fresh = initialTable();
    await admin.from("blackjack_tables").upsert(
      { room_id: roomId, state: toPublicTable(fresh), version: 0 },
      { onConflict: "room_id", ignoreDuplicates: true },
    );
    await admin
      .from("blackjack_private")
      .upsert({ room_id: roomId, full: fresh }, { onConflict: "room_id" });
    return loadOrCreate(admin, roomId);
  }

  const priv = await admin
    .from("blackjack_private")
    .select("full")
    .eq("room_id", roomId)
    .maybeSingle();
  const full = (priv.data?.full as TableState | undefined) ?? initialTable();
  return { full, version: existing.data.version };
}

/** Optimistic-locked write of both the public (masked) and private (full) state. */
async function persist(
  admin: SupabaseClient,
  roomId: string,
  oldVersion: number,
  full: TableState,
): Promise<boolean> {
  const newVersion = oldVersion + 1;
  const next: TableState = { ...full, version: newVersion };
  const updated = await admin
    .from("blackjack_tables")
    .update({
      state: toPublicTable(next),
      version: newVersion,
      updated_at: new Date().toISOString(),
    })
    .eq("room_id", roomId)
    .eq("version", oldVersion)
    .select("room_id");

  if (updated.error) {
    console.error("[blackjack:persist]", updated.error);
    return false;
  }
  if (!updated.data || updated.data.length === 0) return false;

  await admin
    .from("blackjack_private")
    .upsert({ room_id: roomId, full: next }, { onConflict: "room_id" });
  return true;
}

/** Pays out a resolved round once (idempotent) and unlocks the win badge. */
async function settle(roomId: string, full: TableState): Promise<void> {
  if (full.phase !== "done") return;
  for (const seat of full.seats) {
    const payout = seatPayout(seat);
    if (payout > 0) {
      await awardBibcoins(
        seat.userId,
        payout,
        "blackjack_payout",
        `${roomId}:${full.roundNo}:${seat.userId}`,
      );
    }
    if (seat.hands.some((h) => h.result === "win" || h.result === "blackjack")) {
      await unlockAchievement(seat.userId, "blackjack_win");
    }
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : copy.common.genericError;
}

/** Take a seat at the room's table (no charge until you bet). */
export async function joinBlackjack(
  roomId: string,
): Promise<BlackjackActionResult> {
  const auth = await authorize(roomId);
  if (!auth.ok) return auth;

  const loaded = await loadOrCreate(auth.admin, roomId);
  if (loaded.full.seats.some((s) => s.userId === auth.userId)) {
    return { ok: true };
  }
  const ok = await persist(
    auth.admin,
    roomId,
    loaded.version,
    addSeat(loaded.full, auth.userId),
  );
  return ok ? { ok: true } : { ok: false, error: copy.blackjack.busy };
}

/** Leave the table; refunds your bet only if the round hasn't been dealt yet. */
export async function leaveBlackjack(
  roomId: string,
): Promise<BlackjackActionResult> {
  const auth = await authorize(roomId);
  if (!auth.ok) return auth;

  const loaded = await loadOrCreate(auth.admin, roomId);
  const seat = loaded.full.seats.find((s) => s.userId === auth.userId);
  if (!seat) return { ok: true };

  const refund = loaded.full.phase === "betting" ? seat.bet : 0;
  const ok = await persist(
    auth.admin,
    roomId,
    loaded.version,
    removeSeat(loaded.full, auth.userId),
  );
  if (!ok) return { ok: false, error: copy.blackjack.busy };

  if (refund > 0) {
    await awardBibcoins(
      auth.userId,
      refund,
      "blackjack_refund",
      `${roomId}:${loaded.full.roundNo}:${auth.userId}:leave`,
    );
  }
  return { ok: true, balance: await getBibcoins(auth.userId) };
}

/** Place (or replace) your bet for the current round. */
export async function placeBlackjackBet(
  input: PlaceBlackjackBetInput,
): Promise<BlackjackActionResult> {
  const parsed = placeBlackjackBetSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: copy.common.genericError };

  const auth = await authorize(parsed.data.roomId);
  if (!auth.ok) return auth;

  const loaded = await loadOrCreate(auth.admin, parsed.data.roomId);
  if (loaded.full.phase !== "betting") {
    return { ok: false, error: copy.blackjack.roundInProgress };
  }
  const seat = loaded.full.seats.find((s) => s.userId === auth.userId);
  if (seat && seat.bet > 0) {
    return { ok: false, error: copy.blackjack.alreadyBet };
  }

  const balance = await getBibcoins(auth.userId);
  if (parsed.data.amount > balance) {
    return { ok: false, error: copy.blackjack.cantAfford };
  }

  const ref = `${parsed.data.roomId}:${loaded.full.roundNo}:${auth.userId}:bet`;
  const paid = await spendBibcoins(
    auth.userId,
    parsed.data.amount,
    "blackjack_bet",
    ref,
  );
  if (!paid) return { ok: false, error: copy.blackjack.cantAfford };

  let next: TableState;
  try {
    next = placeBet(loaded.full, auth.userId, parsed.data.amount);
  } catch (error) {
    await awardBibcoins(auth.userId, parsed.data.amount, "blackjack_refund", ref);
    return { ok: false, error: messageOf(error) };
  }

  const ok = await persist(auth.admin, parsed.data.roomId, loaded.version, next);
  if (!ok) {
    await awardBibcoins(auth.userId, parsed.data.amount, "blackjack_refund", ref);
    return { ok: false, error: copy.blackjack.busy };
  }
  return { ok: true, balance: await getBibcoins(auth.userId) };
}

/** Deal the round to everyone who has bet (any seated better may trigger it). */
export async function dealBlackjack(
  roomId: string,
): Promise<BlackjackActionResult> {
  const auth = await authorize(roomId);
  if (!auth.ok) return auth;

  const loaded = await loadOrCreate(auth.admin, roomId);
  if (loaded.full.phase !== "betting") {
    return { ok: false, error: copy.blackjack.roundInProgress };
  }

  let next: TableState;
  try {
    next = engineDeal(loaded.full, shuffle(makeDeck(), cryptoRng()));
  } catch (error) {
    return { ok: false, error: messageOf(error) };
  }

  const ok = await persist(auth.admin, roomId, loaded.version, next);
  if (!ok) return { ok: false, error: copy.blackjack.busy };

  await settle(roomId, { ...next, version: loaded.version + 1 });
  return { ok: true };
}

/** Make a turn move (hit/stand/double/split). Charges extra for double/split. */
export async function playBlackjack(
  input: PlayBlackjackInput,
): Promise<BlackjackActionResult> {
  const parsed = playBlackjackSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: copy.common.genericError };

  const auth = await authorize(parsed.data.roomId);
  if (!auth.ok) return auth;

  const loaded = await loadOrCreate(auth.admin, parsed.data.roomId);
  const { full, version } = loaded;
  if (full.phase !== "player" || full.toActIndex === null) {
    return { ok: false, error: copy.blackjack.noRound };
  }
  const seat = full.seats[full.toActIndex];
  if (!seat || seat.userId !== auth.userId) {
    return { ok: false, error: copy.blackjack.notYourTurn };
  }

  const action = parsed.data.action as SeatActionKind;

  // Double/split cost an extra stake, charged before the move is applied.
  let charge = 0;
  let ref = "";
  if (action === "double") {
    charge = seat.hands[seat.activeHand]?.bet ?? 0;
    ref = `${parsed.data.roomId}:${full.roundNo}:${auth.userId}:double:${seat.activeHand}`;
  } else if (action === "split") {
    charge = seat.hands[0]?.bet ?? 0;
    ref = `${parsed.data.roomId}:${full.roundNo}:${auth.userId}:split`;
  }
  if (charge > 0) {
    const paid = await spendBibcoins(auth.userId, charge, "blackjack_bet", ref);
    if (!paid) return { ok: false, error: copy.blackjack.cantAfford };
  }

  let next: TableState;
  try {
    next = applyAction(full, auth.userId, action);
  } catch (error) {
    if (charge > 0) {
      await awardBibcoins(auth.userId, charge, "blackjack_refund", ref);
    }
    return { ok: false, error: messageOf(error) };
  }

  const ok = await persist(auth.admin, parsed.data.roomId, version, next);
  if (!ok) {
    if (charge > 0) {
      await awardBibcoins(auth.userId, charge, "blackjack_refund", ref);
    }
    return { ok: false, error: copy.blackjack.busy };
  }

  await settle(parsed.data.roomId, { ...next, version: version + 1 });
  return { ok: true, balance: await getBibcoins(auth.userId) };
}

/** Start a fresh betting round after one finishes. */
export async function startBlackjackRound(
  roomId: string,
): Promise<BlackjackActionResult> {
  const auth = await authorize(roomId);
  if (!auth.ok) return auth;

  const loaded = await loadOrCreate(auth.admin, roomId);
  if (loaded.full.phase !== "done") {
    return { ok: false, error: copy.blackjack.roundInProgress };
  }
  const ok = await persist(
    auth.admin,
    roomId,
    loaded.version,
    startBetting(loaded.full),
  );
  return ok ? { ok: true } : { ok: false, error: copy.blackjack.busy };
}
