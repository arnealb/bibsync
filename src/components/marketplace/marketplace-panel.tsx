"use client";

import { useState } from "react";

import { CreateOfferForm } from "@/components/marketplace/create-offer-form";
import { OfferCard } from "@/components/marketplace/offer-card";
import { useMarketRealtime } from "@/hooks/use-offers-realtime";
import { copy } from "@/lib/copy";
import type { MemberMap } from "@/lib/members";
import type { ServiceBid, ServiceOffer } from "@/types/database";

/** Sort: open first, then hired, then done; newest within each. */
const STATUS_ORDER: Record<string, number> = { open: 0, hired: 1, done: 2 };

export function MarketplacePanel({
  roomId,
  userId,
  members,
  initialOffers,
  initialBids,
  initialBalance,
}: {
  roomId: string;
  userId: string;
  members: MemberMap;
  initialOffers: ServiceOffer[];
  initialBids: ServiceBid[];
  initialBalance: number;
}) {
  const [offers, setOffers] = useState<ServiceOffer[]>(initialOffers);
  const [bids, setBids] = useState<ServiceBid[]>(initialBids);
  const [balance, setBalance] = useState(initialBalance);

  const upsertOffer = (o: ServiceOffer) =>
    setOffers((prev) =>
      prev.some((p) => p.id === o.id)
        ? prev.map((p) => (p.id === o.id ? o : p))
        : [o, ...prev],
    );
  const upsertBid = (b: ServiceBid) =>
    setBids((prev) =>
      prev.some((p) => p.id === b.id)
        ? prev.map((p) => (p.id === b.id ? b : p))
        : [...prev, b],
    );

  useMarketRealtime(roomId, {
    onOfferInsert: upsertOffer,
    onOfferUpdate: upsertOffer,
    onOfferDelete: (id) => setOffers((prev) => prev.filter((o) => o.id !== id)),
    onBidInsert: upsertBid,
    onBidUpdate: upsertBid,
    onBidDelete: (id) => setBids((prev) => prev.filter((b) => b.id !== id)),
  });

  const sorted = [...offers].sort((a, b) => {
    const s = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
    return s !== 0 ? s : b.created_at.localeCompare(a.created_at);
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">
          {copy.marketplace.title}
        </h2>
        <p className="text-sm text-muted-foreground">
          {copy.marketplace.subtitle}
        </p>
      </div>

      <CreateOfferForm roomId={roomId} onCreated={upsertOffer} />

      {sorted.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {copy.marketplace.empty}
        </p>
      ) : (
        <div className="space-y-3">
          {sorted.map((offer) => (
            <OfferCard
              key={offer.id}
              offer={offer}
              bids={bids.filter((b) => b.offer_id === offer.id)}
              members={members}
              userId={userId}
              balance={balance}
              onBalance={setBalance}
            />
          ))}
        </div>
      )}
    </div>
  );
}
