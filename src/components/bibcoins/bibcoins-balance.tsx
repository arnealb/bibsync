"use client";

import Link from "next/link";
import { Coins } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useBibcoinsRealtime } from "@/hooks/use-bibcoins-realtime";
import { copy } from "@/lib/copy";

/**
 * Header bibcoins counter. Seeded from the server-rendered balance, then kept
 * live via the wallet realtime subscription so it updates mid-game without a
 * page refresh.
 */
export function BibcoinsBalance({
  userId,
  initialBalance,
}: {
  userId: string;
  initialBalance: number;
}) {
  const [balance, setBalance] = useState(initialBalance);
  useBibcoinsRealtime(userId, setBalance);

  return (
    <Button
      render={<Link href="/app/shop" />}
      nativeButton={false}
      variant="ghost"
      size="sm"
      className="gap-1.5 font-mono tabular-nums"
      aria-label={copy.bibcoins.shop.nav}
    >
      <Coins className="size-4 text-amber-500" />
      {balance}
    </Button>
  );
}
