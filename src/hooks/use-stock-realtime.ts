"use client";

import { useEffect, useRef } from "react";

import { createClient } from "@/lib/supabase/client";

/** Subscribes to casino-stock changes (any trade by anyone, or an hourly tick). */
export function useStockRealtime(onChange: () => void) {
  const ref = useRef(onChange);
  useEffect(() => {
    ref.current = onChange;
  });

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`casino-stock:${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "casino_stock" },
        () => ref.current(),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "casino_stock_history" },
        () => ref.current(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);
}
