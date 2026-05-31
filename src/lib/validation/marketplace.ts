import { z } from "zod";

import {
  OFFER_DESCRIPTION_MAX,
  OFFER_KINDS,
  OFFER_PRICE_MAX,
  OFFER_PRICE_MIN,
  OFFER_TITLE_MAX,
} from "@/lib/marketplace/config";

/** Post a service for hire ('offer') or a request others can bid on ('request'). */
export const createOfferSchema = z.object({
  roomId: z.string().uuid(),
  kind: z.enum(OFFER_KINDS),
  title: z.string().trim().min(1).max(OFFER_TITLE_MAX),
  description: z.string().trim().max(OFFER_DESCRIPTION_MAX).default(""),
  price: z.number().int().min(OFFER_PRICE_MIN).max(OFFER_PRICE_MAX),
});
export type CreateOfferInput = z.infer<typeof createOfferSchema>;

/** Bid on a 'request' offer. */
export const placeBidSchema = z.object({
  offerId: z.string().uuid(),
  price: z.number().int().min(OFFER_PRICE_MIN).max(OFFER_PRICE_MAX),
});
export type PlaceBidInput = z.infer<typeof placeBidSchema>;
