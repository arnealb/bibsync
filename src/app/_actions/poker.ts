"use server";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { ActionResult } from "@/app/_actions/types";
import { copy } from "@/lib/copy";
import { makeDeck, shuffle, type Card } from "@/lib/poker/cards";
import {
  POKER_SMALL_BLIND,
  POKER_BIG_BLIND,
  POKER_START_CHIPS,
} from "@/lib/poker/config";
import {
  addPlayer,
  applyAction,
  initialState,
  rebuy as engineRebuy,
  startHand as engineStartHand,
  toPublicState,
  type FullState,
  type PublicState,
} from "@/lib/poker/engine";
import { getMyHoleCards, getPokerTable } from "@/lib/poker/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRoomAccess } from "@/lib/rooms/queries";
import { playerActionSchema, type PlayerActionInput } from "@/lib/validation/poker";

type MyHandResult =
  | { ok: true; cards: Card[] | null }
  | { ok: false; error: string };

interface Loaded {
  full: FullState;
  version: number;
}

/** Cryptographically-seeded RNG in [0, 1) for an unpredictable shuffle. */
function cryptoRng(): () => number {
  return () => {
    const buf = new Uint32Array(1);
    globalThis.crypto.getRandomValues(buf);
    return buf[0] / 2 ** 32;
  };
}

/** Reads the full (public + private) state, creating an empty table if needed. */
async function loadOrCreate(
  admin: SupabaseClient,
  roomId: string,
): Promise<Loaded> {
  const existing = await admin
    .from("poker_tables")
    .select("state, version")
    .eq("room_id", roomId)
    .maybeSingle();

  if (!existing.data) {
    const fresh = initialState(POKER_SMALL_BLIND, POKER_BIG_BLIND);
    await admin
      .from("poker_tables")
      .upsert(
        { room_id: roomId, state: toPublicState(fresh), version: 0 },
        { onConflict: "room_id", ignoreDuplicates: true },
      );
    return loadOrCreate(admin, roomId);
  }

  const pub = existing.data.state as unknown as PublicState;
  const priv = await admin
    .from("poker_private")
    .select("deck")
    .eq("room_id", roomId)
    .maybeSingle();
  const holes = await admin
    .from("poker_hole_cards")
    .select("user_id, cards")
    .eq("room_id", roomId)
    .eq("hand_no", pub.handNo);

  const hole: Record<string, [Card, Card]> = {};
  for (const row of holes.data ?? []) {
    hole[row.user_id] = row.cards as [Card, Card];
  }

  return {
    full: {
      ...pub,
      deck: (priv.data?.deck as Card[] | undefined) ?? [],
      hole,
    },
    version: existing.data.version,
  };
}

/**
 * Persists the new state with an optimistic version check: the update only
 * applies if nobody else moved since we loaded. Returns false on a lost race.
 */
async function persist(
  admin: SupabaseClient,
  roomId: string,
  oldVersion: number,
  full: FullState,
): Promise<boolean> {
  const newVersion = oldVersion + 1;
  const pub = toPublicState({ ...full, version: newVersion });
  const updated = await admin
    .from("poker_tables")
    .update({
      state: pub,
      version: newVersion,
      updated_at: new Date().toISOString(),
    })
    .eq("room_id", roomId)
    .eq("version", oldVersion)
    .select("room_id");

  if (updated.error) {
    console.error("[poker:persist]", updated.error);
    return false;
  }
  if (!updated.data || updated.data.length === 0) return false;

  await admin
    .from("poker_private")
    .upsert({ room_id: roomId, hand_no: full.handNo, deck: full.deck });
  return true;
}

/** Resolves the current user and a service client, or an error result. */
async function authorize(
  roomId: string,
): Promise<
  | { ok: true; userId: string; admin: SupabaseClient }
  | { ok: false; error: string }
> {
  const access = await requireRoomAccess(roomId);
  if (!access) return { ok: false, error: copy.common.notAuthenticated };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: copy.poker.unavailable };
  return { ok: true, userId: access.userId, admin };
}

/** Sit down at the table (idempotent); seeds the starting stack. */
export async function sitDownPoker(roomId: string): Promise<ActionResult> {
  const auth = await authorize(roomId);
  if (!auth.ok) return auth;

  const loaded = await loadOrCreate(auth.admin, roomId);
  if (loaded.full.status === "betting") {
    // Seats can still be added; the player simply joins the next hand.
  }
  const next = addPlayer(loaded.full, auth.userId, POKER_START_CHIPS);
  if (next === loaded.full) return { ok: true }; // already seated

  const ok = await persist(auth.admin, roomId, loaded.version, next);
  return ok ? { ok: true } : { ok: false, error: copy.poker.busy };
}

/** Deal a new hand. */
export async function startPokerHand(roomId: string): Promise<ActionResult> {
  const auth = await authorize(roomId);
  if (!auth.ok) return auth;

  const loaded = await loadOrCreate(auth.admin, roomId);
  if (loaded.full.status === "betting") {
    return { ok: false, error: copy.poker.handInProgress };
  }

  let next: FullState;
  try {
    next = engineStartHand(loaded.full, shuffle(makeDeck(), cryptoRng()));
  } catch (error) {
    return { ok: false, error: messageOf(error) };
  }

  // Write hole cards before flipping the public state so they exist by the
  // time clients see the new hand number.
  await auth.admin
    .from("poker_hole_cards")
    .delete()
    .eq("room_id", roomId)
    .neq("hand_no", next.handNo);
  const rows = Object.entries(next.hole).map(([userId, cards]) => ({
    room_id: roomId,
    hand_no: next.handNo,
    user_id: userId,
    cards,
  }));
  if (rows.length > 0) {
    await auth.admin.from("poker_hole_cards").upsert(rows);
  }

  const ok = await persist(auth.admin, roomId, loaded.version, next);
  return ok ? { ok: true } : { ok: false, error: copy.poker.busy };
}

/** Make a move (fold/check/call/raise/allin). */
export async function playPokerAction(
  input: PlayerActionInput,
): Promise<ActionResult> {
  const parsed = playerActionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: copy.common.genericError };

  const auth = await authorize(parsed.data.roomId);
  if (!auth.ok) return auth;

  const loaded = await loadOrCreate(auth.admin, parsed.data.roomId);
  if (loaded.full.status !== "betting") {
    return { ok: false, error: copy.poker.noHand };
  }

  let next: FullState;
  try {
    next = applyAction(
      loaded.full,
      auth.userId,
      parsed.data.action,
      parsed.data.amount ?? 0,
    );
  } catch (error) {
    return { ok: false, error: messageOf(error) };
  }

  const ok = await persist(auth.admin, parsed.data.roomId, loaded.version, next);
  return ok ? { ok: true } : { ok: false, error: copy.poker.busy };
}

/** Top a busted player back up to the starting stack between hands. */
export async function rebuyPoker(roomId: string): Promise<ActionResult> {
  const auth = await authorize(roomId);
  if (!auth.ok) return auth;

  const loaded = await loadOrCreate(auth.admin, roomId);
  const next = engineRebuy(loaded.full, auth.userId, POKER_START_CHIPS);
  if (next === loaded.full) return { ok: true };

  const ok = await persist(auth.admin, roomId, loaded.version, next);
  return ok ? { ok: true } : { ok: false, error: copy.poker.busy };
}

/** The current user's hole cards for the live hand. */
export async function getMyPokerHand(roomId: string): Promise<MyHandResult> {
  const access = await requireRoomAccess(roomId);
  if (!access) return { ok: false, error: copy.common.notAuthenticated };

  const table = await getPokerTable(roomId);
  if (!table) return { ok: true, cards: null };

  const cards = await getMyHoleCards(roomId, table.handNo, access.userId);
  return { ok: true, cards };
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : copy.common.genericError;
}
