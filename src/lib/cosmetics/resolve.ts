import { COSMETIC_BY_ID, type CosmeticItem } from "@/lib/cosmetics/catalog";
import type { UserLoadout } from "@/types/database";

export interface ResolvedLoadout {
  frame: CosmeticItem | null;
  color: CosmeticItem | null;
  badge: CosmeticItem | null;
  accessory: CosmeticItem | null;
  pet: CosmeticItem | null;
  title: CosmeticItem | null;
  effect: CosmeticItem | null;
}

function itemOrNull(id: string | null | undefined): CosmeticItem | null {
  return id ? (COSMETIC_BY_ID.get(id) ?? null) : null;
}

/** Turns a stored loadout row into resolved catalogue items for rendering. */
export function resolveLoadout(
  loadout?: Partial<UserLoadout> | null,
): ResolvedLoadout {
  return {
    frame: itemOrNull(loadout?.frame),
    color: itemOrNull(loadout?.name_color),
    badge: itemOrNull(loadout?.badge),
    accessory: itemOrNull(loadout?.accessory),
    pet: itemOrNull(loadout?.pet),
    title: itemOrNull(loadout?.title),
    effect: itemOrNull(loadout?.effect),
  };
}

export const EMPTY_LOADOUT: ResolvedLoadout = {
  frame: null,
  color: null,
  badge: null,
  accessory: null,
  pet: null,
  title: null,
  effect: null,
};
