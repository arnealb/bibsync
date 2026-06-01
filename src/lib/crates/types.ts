import type { CosmeticType } from "@/lib/cosmetics/catalog";
import type { Rarity } from "@/lib/crates/config";

/** What the client needs to render the reveal of an opened crate. */
export interface CratePrize {
  id: string;
  name: string;
  type: CosmeticType;
  value: string;
  rarity: Rarity;
}

export type CrateResult =
  | {
      ok: true;
      prize: CratePrize;
      /** You already owned it → refunded instead of granted. */
      duplicate: boolean;
      /** Coins given back on a duplicate (0 for a new item). */
      refund: number;
      balance: number;
    }
  | { ok: false; error: string };
