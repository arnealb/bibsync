"use server";

import { revalidatePath } from "next/cache";

import { getAuthContext } from "@/lib/auth";
import { awardBibcoins, spendBibcoins } from "@/lib/bibcoins/award";
import { getBibcoins } from "@/lib/bibcoins/queries";
import { unlockAchievement } from "@/lib/bibcoins/unlock";
import { copy } from "@/lib/copy";
import { CRATE_PRICE, DUP_REFUND_FRACTION } from "@/lib/crates/config";
import { rollCrate } from "@/lib/crates/engine";
import type { CrateResult } from "@/lib/crates/types";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Open one mystery crate. Server-authoritative: stake the price, roll a random
 * cosmetic, then either grant it (new) or refund a slice (duplicate). The
 * stake is a coin sink; the roll pool excludes premium items so it can't be
 * exploited for cheap high-value cosmetics.
 */
export async function openCrate(): Promise<CrateResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { ok: false, error: copy.common.notAuthenticated };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: copy.crates.unavailable };
  const userId = ctx.user.id;

  const ref = `crate:${userId}:${crypto.randomUUID()}`;
  const paid = await spendBibcoins(userId, CRATE_PRICE, "crate_open", ref);
  if (!paid) return { ok: false, error: copy.crates.cantAfford };

  const { item, rarity } = rollCrate(Math.random(), Math.random());

  const { data: owned } = await admin
    .from("user_cosmetics")
    .select("item_id")
    .eq("user_id", userId)
    .eq("item_id", item.id)
    .maybeSingle();

  const prize = {
    id: item.id,
    name: item.name,
    type: item.type,
    value: item.value,
    rarity,
  };

  if (owned) {
    const refund = Math.floor(CRATE_PRICE * DUP_REFUND_FRACTION);
    if (refund > 0) {
      await awardBibcoins(userId, refund, "crate_dup", ref);
    }
    return { ok: true, prize, duplicate: true, refund, balance: await getBibcoins(userId) };
  }

  const { error } = await admin
    .from("user_cosmetics")
    .insert({ user_id: userId, item_id: item.id });
  if (error) {
    console.error("[openCrate]", error);
    // Couldn't grant the item — refund the full price so coins aren't lost.
    await awardBibcoins(userId, CRATE_PRICE, "crate_refund", ref);
    return { ok: false, error: copy.crates.unavailable };
  }

  await unlockAchievement(userId, "shopaholic");
  revalidatePath("/app/shop");
  revalidatePath("/app/profile");
  return { ok: true, prize, duplicate: false, refund: 0, balance: await getBibcoins(userId) };
}
