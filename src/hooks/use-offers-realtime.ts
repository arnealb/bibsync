"use client";

import { useEffect, useRef } from "react";

import { createClient } from "@/lib/supabase/client";
import type { ServiceBid, ServiceOffer } from "@/types/database";

export interface MarketRealtimeHandlers {
  onOfferInsert: (offer: ServiceOffer) => void;
  onOfferUpdate: (offer: ServiceOffer) => void;
  onOfferDelete: (id: string) => void;
  onBidInsert: (bid: ServiceBid) => void;
  onBidUpdate: (bid: ServiceBid) => void;
  onBidDelete: (id: string) => void;
}

/** Subscribes to a room's klussenmarkt — offers and their bids. */
export function useMarketRealtime(
  roomId: string,
  handlers: MarketRealtimeHandlers,
) {
  const ref = useRef(handlers);
  useEffect(() => {
    ref.current = handlers;
  });

  useEffect(() => {
    const supabase = createClient();
    const filter = `room_id=eq.${roomId}`;
    const channel = supabase
      .channel(`room:${roomId}:market:${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "service_offers", filter },
        (p) => ref.current.onOfferInsert(p.new as ServiceOffer),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "service_offers", filter },
        (p) => ref.current.onOfferUpdate(p.new as ServiceOffer),
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "service_offers", filter },
        (p) => {
          const old = p.old as { id?: string };
          if (old?.id) ref.current.onOfferDelete(old.id);
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "service_bids", filter },
        (p) => ref.current.onBidInsert(p.new as ServiceBid),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "service_bids", filter },
        (p) => ref.current.onBidUpdate(p.new as ServiceBid),
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "service_bids", filter },
        (p) => {
          const old = p.old as { id?: string };
          if (old?.id) ref.current.onBidDelete(old.id);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [roomId]);
}
