"use server";

import { transferBibcoins } from "@/lib/bibcoins/award";
import { getBibcoins } from "@/lib/bibcoins/queries";
import { copy } from "@/lib/copy";
import { requireRoomAccess } from "@/lib/rooms/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  createOfferSchema,
  placeBidSchema,
  type CreateOfferInput,
  type PlaceBidInput,
} from "@/lib/validation/marketplace";
import type { ServiceOffer } from "@/types/database";

export type CreateOfferResult =
  | { ok: true; offer: ServiceOffer }
  | { ok: false; error: string };

export type OfferActionResult =
  | { ok: true; balance?: number }
  | { ok: false; error: string };

/** Post a service for hire ('offer') or a request others can bid on ('request'). */
export async function createOffer(
  input: CreateOfferInput,
): Promise<CreateOfferResult> {
  const parsed = createOfferSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: copy.common.genericError };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: copy.common.notAuthenticated };

  const { data, error } = await supabase
    .from("service_offers")
    .insert({
      room_id: parsed.data.roomId,
      author_id: user.id,
      kind: parsed.data.kind,
      title: parsed.data.title,
      description: parsed.data.description,
      price: parsed.data.price,
    })
    .select("*")
    .single();

  if (error || !data) {
    console.error("[createOffer]", error);
    return { ok: false, error: copy.marketplace.error };
  }
  return { ok: true, offer: data };
}

/** Hire an open 'offer': the buyer pays the author now. */
export async function hireOffer(offerId: string): Promise<OfferActionResult> {
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: copy.marketplace.unavailable };

  const { data: offer } = await admin
    .from("service_offers")
    .select("id, room_id, author_id, kind, price, status")
    .eq("id", offerId)
    .maybeSingle();
  if (!offer) return { ok: false, error: copy.marketplace.gone };
  if (offer.kind !== "offer" || offer.status !== "open") {
    return { ok: false, error: copy.marketplace.alreadyHired };
  }

  const access = await requireRoomAccess(offer.room_id);
  if (!access) return { ok: false, error: copy.common.notAuthenticated };
  if (offer.author_id === access.userId) {
    return { ok: false, error: copy.marketplace.ownOffer };
  }
  if ((await getBibcoins(access.userId)) < offer.price) {
    return { ok: false, error: copy.marketplace.cantAfford };
  }

  // Buyer pays the author, author keeps the agreed price.
  return settleHire(
    admin,
    offerId,
    access.userId,
    offer.author_id,
    access.userId,
    offer.price,
  );
}

/** Place (or update) your bid on a 'request'. */
export async function placeBid(input: PlaceBidInput): Promise<OfferActionResult> {
  const parsed = placeBidSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: copy.common.genericError };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: copy.common.notAuthenticated };

  const { data: offer } = await supabase
    .from("service_offers")
    .select("room_id, author_id, kind, status")
    .eq("id", parsed.data.offerId)
    .maybeSingle();
  if (!offer || offer.kind !== "request" || offer.status !== "open") {
    return { ok: false, error: copy.marketplace.gone };
  }
  if (offer.author_id === user.id) {
    return { ok: false, error: copy.marketplace.ownOffer };
  }

  const { error } = await supabase.from("service_bids").upsert(
    {
      offer_id: parsed.data.offerId,
      room_id: offer.room_id,
      bidder_id: user.id,
      price: parsed.data.price,
    },
    { onConflict: "offer_id,bidder_id" },
  );
  if (error) {
    console.error("[placeBid]", error);
    return { ok: false, error: copy.marketplace.error };
  }
  return { ok: true };
}

/** Withdraw your bid. */
export async function withdrawBid(offerId: string): Promise<OfferActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: copy.common.notAuthenticated };

  const { error } = await supabase
    .from("service_bids")
    .delete()
    .eq("offer_id", offerId)
    .eq("bidder_id", user.id);
  if (error) {
    console.error("[withdrawBid]", error);
    return { ok: false, error: copy.marketplace.error };
  }
  return { ok: true };
}

/** The request's author accepts a bid: pay that bidder and mark it hired. */
export async function acceptBid(bidId: string): Promise<OfferActionResult> {
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: copy.marketplace.unavailable };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: copy.common.notAuthenticated };

  const { data: bid } = await admin
    .from("service_bids")
    .select("offer_id, bidder_id, price")
    .eq("id", bidId)
    .maybeSingle();
  if (!bid) return { ok: false, error: copy.marketplace.gone };

  const { data: offer } = await admin
    .from("service_offers")
    .select("id, author_id, kind, status")
    .eq("id", bid.offer_id)
    .maybeSingle();
  if (!offer || offer.kind !== "request" || offer.status !== "open") {
    return { ok: false, error: copy.marketplace.alreadyHired };
  }
  if (offer.author_id !== user.id) {
    return { ok: false, error: copy.common.notAuthenticated };
  }
  if ((await getBibcoins(user.id)) < bid.price) {
    return { ok: false, error: copy.marketplace.cantAfford };
  }

  // Author pays the bidder the bid price.
  return settleHire(admin, offer.id, user.id, user.id, bid.bidder_id, bid.price);
}

/**
 * Atomically claim an open offer (open → hired) and move the money from `payer`
 * to `payee`, rolling the claim back if the transfer can't go through.
 */
async function settleHire(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  offerId: string,
  hiredBy: string,
  payer: string,
  payee: string,
  price: number,
): Promise<OfferActionResult> {
  const claim = await admin
    .from("service_offers")
    .update({
      status: "hired",
      hired_by: hiredBy,
      agreed_price: price,
      hired_at: new Date().toISOString(),
    })
    .eq("id", offerId)
    .eq("status", "open")
    .select("id");
  if (claim.error || !claim.data || claim.data.length === 0) {
    return { ok: false, error: copy.marketplace.alreadyHired };
  }

  const paid = await transferBibcoins(
    payer,
    payee,
    price,
    `offer:${offerId}:${hiredBy}`,
  );
  if (!paid) {
    await admin
      .from("service_offers")
      .update({ status: "open", hired_by: null, agreed_price: null, hired_at: null })
      .eq("id", offerId);
    return { ok: false, error: copy.marketplace.cantAfford };
  }

  return { ok: true, balance: await getBibcoins(payer) };
}

/** The author marks a hired offer as delivered. */
export async function completeOffer(
  offerId: string,
): Promise<OfferActionResult> {
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: copy.marketplace.unavailable };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: copy.common.notAuthenticated };

  const done = await admin
    .from("service_offers")
    .update({ status: "done", completed_at: new Date().toISOString() })
    .eq("id", offerId)
    .eq("author_id", user.id)
    .eq("status", "hired")
    .select("id");
  if (done.error || !done.data || done.data.length === 0) {
    return { ok: false, error: copy.marketplace.error };
  }
  return { ok: true };
}

/** The author withdraws an offer/request that hasn't been hired yet. */
export async function cancelOffer(offerId: string): Promise<OfferActionResult> {
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: copy.marketplace.unavailable };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: copy.common.notAuthenticated };

  const del = await admin
    .from("service_offers")
    .delete()
    .eq("id", offerId)
    .eq("author_id", user.id)
    .eq("status", "open")
    .select("id");
  if (del.error || !del.data || del.data.length === 0) {
    return { ok: false, error: copy.marketplace.error };
  }
  return { ok: true };
}
