import { z } from "zod";

import { COSMETIC_TYPES } from "@/lib/cosmetics/catalog";

export const buyCosmeticSchema = z.object({ itemId: z.string().min(1) });

export const equipSchema = z.object({
  type: z.enum(COSMETIC_TYPES as unknown as [string, ...string[]]),
  itemId: z.string().min(1).nullable(),
});

export type EquipInput = z.infer<typeof equipSchema>;
