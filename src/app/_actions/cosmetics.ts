"use server";

import { revalidatePath } from "next/cache";

import type { ActionResult } from "@/app/_actions/types";
import { spendBibcoins } from "@/lib/bibcoins/award";
import { unlockAchievement } from "@/lib/bibcoins/unlock";
import {
  COSMETIC_BY_ID,
  TYPE_COLUMN,
  type CosmeticType,
} from "@/lib/cosmetics/catalog";
import { copy } from "@/lib/copy";
import { getAuthContext } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { buyCosmeticSchema, equipSchema } from "@/lib/validation/cosmetics";

/** Buy a cosmetic with bibcoins (idempotent on re-buy of an owned item). */
export async function buyCosmetic(itemId: string): Promise<ActionResult> {
  const parsed = buyCosmeticSchema.safeParse({ itemId });
  if (!parsed.success) return { ok: false, error: copy.common.genericError };

  const item = COSMETIC_BY_ID.get(parsed.data.itemId);
  if (!item) return { ok: false, error: copy.common.genericError };

  const ctx = await getAuthContext();
  if (!ctx) return { ok: false, error: copy.common.notAuthenticated };

  const admin = createAdminClient();
  if (!admin) return { ok: false, error: copy.bibcoins.shop.error };

  const { data: owned } = await admin
    .from("user_cosmetics")
    .select("item_id")
    .eq("user_id", ctx.user.id)
    .eq("item_id", item.id)
    .maybeSingle();
  if (owned) return { ok: true }; // already owns it

  const paid = await spendBibcoins(ctx.user.id, item.price, "buy", item.id);
  if (!paid) return { ok: false, error: copy.bibcoins.shop.cantAfford };

  const { error } = await admin
    .from("user_cosmetics")
    .insert({ user_id: ctx.user.id, item_id: item.id });
  if (error) {
    console.error("[buyCosmetic]", error);
    return { ok: false, error: copy.bibcoins.shop.error };
  }

  await unlockAchievement(ctx.user.id, "shopaholic");
  revalidatePath("/app/shop");
  revalidatePath("/app/profile");
  return { ok: true };
}

/** Equip (or, with itemId=null, unequip) a cosmetic in its slot. */
export async function equipCosmetic(input: {
  type: CosmeticType;
  itemId: string | null;
}): Promise<ActionResult> {
  const parsed = equipSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: copy.common.genericError };
  const type = parsed.data.type as CosmeticType;
  const itemId = parsed.data.itemId;

  const ctx = await getAuthContext();
  if (!ctx) return { ok: false, error: copy.common.notAuthenticated };

  const admin = createAdminClient();
  if (!admin) return { ok: false, error: copy.bibcoins.shop.error };

  if (itemId) {
    const item = COSMETIC_BY_ID.get(itemId);
    if (!item || item.type !== type) {
      return { ok: false, error: copy.common.genericError };
    }
    const { data: owned } = await admin
      .from("user_cosmetics")
      .select("item_id")
      .eq("user_id", ctx.user.id)
      .eq("item_id", itemId)
      .maybeSingle();
    if (!owned) return { ok: false, error: copy.common.genericError };
  }

  const { data: existing } = await admin
    .from("user_loadout")
    .select("*")
    .eq("user_id", ctx.user.id)
    .maybeSingle();

  const merged: Record<string, string | null> = {
    user_id: ctx.user.id,
    frame: existing?.frame ?? null,
    name_color: existing?.name_color ?? null,
    badge: existing?.badge ?? null,
    accessory: existing?.accessory ?? null,
    pet: existing?.pet ?? null,
    title: existing?.title ?? null,
    effect: existing?.effect ?? null,
    updated_at: new Date().toISOString(),
  };
  merged[TYPE_COLUMN[type]] = itemId;

  const { error } = await admin
    .from("user_loadout")
    .upsert(merged, { onConflict: "user_id" });
  if (error) {
    console.error("[equipCosmetic]", error);
    return { ok: false, error: copy.bibcoins.shop.error };
  }

  if (merged.frame && merged.badge) {
    await unlockAchievement(ctx.user.id, "stylist");
  }
  revalidatePath("/app/shop");
  revalidatePath("/app/profile");
  return { ok: true };
}
