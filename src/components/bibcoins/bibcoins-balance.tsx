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
  initialDebt = 0,
}: {
  userId: string;
  initialBalance: number;
  initialDebt?: number;
}) {
  const [balance, setBalance] = useState(initialBalance);
  const [debt, setDebt] = useState(initialDebt);
  useBibcoinsRealtime(userId, (bibcoins, nextDebt) => {
    setBalance(bibcoins);
    if (typeof nextDebt === "number") setDebt(nextDebt);
  });

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
      {debt > 0 && (
        <span
          className="font-semibold text-red-600 dark:text-red-400"
          title={copy.theft.debtHint}
        >
          −{debt}
        </span>
      )}
    </Button>
  );
}
