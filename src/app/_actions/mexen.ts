"use server";

import { transferBibcoins } from "@/lib/bibcoins/award";
import { copy } from "@/lib/copy";
import { getRoomMembers, requireRoomAccess } from "@/lib/rooms/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  rollMexenSchema,
  settleMexenSchema,
  type RollMexenInput,
  type SettleMexenInput,
} from "@/lib/validation/mexen";

export type MexenRollResult =
  | { ok: true; dice: [number, number] }
  | { ok: false; error: string };

export type MexenSettleResult =
  | { ok: true }
  | { ok: false; error: string };

/** Uniform [0,1) from the CSPRNG — rolls the dice server-side. */
function cryptoRng(): number {
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return buf[0] / 2 ** 32;
}

function rollDie(): number {
  return 1 + Math.min(5, Math.floor(cryptoRng() * 6));
}

/** Roll a fair pair of dice. Pass-and-play game state lives on the client. */
export async function rollMexenDice(
  input: RollMexenInput,
): Promise<MexenRollResult> {
  const parsed = rollMexenSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: copy.common.genericError };

  const access = await requireRoomAccess(parsed.data.roomId);
  if (!access) return { ok: false, error: copy.common.notAuthenticated };
  if (access.isPilloried) return { ok: false, error: copy.pillory.frozen };

  return { ok: true, dice: [rollDie(), rollDie()] };
}

/**
 * Settle one round's stake: the loser pays the winner. Both must be members of
 * the room (this is local pass-and-play, so the logged-in device owner moves
 * coins on the players' behalf). Idempotent per `ref`.
 */
export async function settleMexenRound(
  input: SettleMexenInput,
): Promise<MexenSettleResult> {
  const parsed = settleMexenSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: copy.common.genericError };
  const { roomId, loserId, winnerId, stake, ref } = parsed.data;

  if (loserId === winnerId) {
    return { ok: false, error: copy.common.genericError };
  }

  const access = await requireRoomAccess(roomId);
  if (!access) return { ok: false, error: copy.common.notAuthenticated };
  if (access.isPilloried) return { ok: false, error: copy.pillory.frozen };
  if (!createAdminClient()) {
    return { ok: false, error: copy.mexen.unavailable };
  }

  const members = await getRoomMembers(roomId);
  const memberIds = new Set(members.map((m) => m.user_id));
  if (!memberIds.has(loserId) || !memberIds.has(winnerId)) {
    return { ok: false, error: copy.mexen.notMember };
  }

  const moved = await transferBibcoins(
    loserId,
    winnerId,
    stake,
    `mexen:${roomId}:${ref}`,
  );
  if (!moved) return { ok: false, error: copy.mexen.settleFailed };

  return { ok: true };
}
