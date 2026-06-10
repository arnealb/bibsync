import { z } from "zod";

/**
 * Shapes for the Hydra resto feed. The feed is external data, so every field
 * is validated and defaulted defensively — names/prices are occasionally messy
 * (truncated, allergen text bleeds into fields), so consumers must clean them.
 */
export const restoMealSchema = z.object({
  kind: z.string(),
  name: z.string(),
  price: z.string().nullish(),
  type: z.string().default("main"),
  allergens: z.array(z.string()).default([]),
});

export const restoDaySchema = z.object({
  date: z.string(),
  open: z.boolean().default(true),
  meals: z.array(restoMealSchema).default([]),
  vegetables: z.array(z.string()).default([]),
});

export const restoOverviewSchema = z.array(restoDaySchema);

export type RestoMeal = z.infer<typeof restoMealSchema>;
export type RestoDay = z.infer<typeof restoDaySchema>;
