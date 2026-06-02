"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Gift, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { openCrate } from "@/app/_actions/crates";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { copy } from "@/lib/copy";
import { CRATE_PRICE, RARITY_META } from "@/lib/crates/config";
import type { CratePrize } from "@/lib/crates/types";
import { cn } from "@/lib/utils";

const RAINBOW =
  "conic-gradient(from 0deg, #ef4444, #f59e0b, #eab308, #22c55e, #38bdf8, #a855f7, #ec4899, #ef4444)";

/** Compact preview of any prize (mirrors the shop's item preview). */
function PrizePreview({ prize }: { prize: CratePrize }) {
  if (prize.type === "frame") {
    return (
      <span
        className="inline-flex size-14 items-center justify-center rounded-full p-[4px]"
        style={{ background: prize.value === "rainbow" ? RAINBOW : prize.value }}
      >
        <span className="size-full rounded-full bg-muted" />
      </span>
    );
  }
  if (prize.type === "color") {
    return (
      <span className="text-4xl font-bold" style={{ color: prize.value }}>
        Aa
      </span>
    );
  }
  return <span className="text-5xl leading-none">{prize.value}</span>;
}

/** Mystery-crate gacha: pay to open, reveal a random cosmetic. */
export function CrateBox({ balance }: { balance: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [prize, setPrize] = useState<CratePrize | null>(null);
  const [duplicate, setDuplicate] = useState(false);

  function open() {
    start(async () => {
      const res = await openCrate();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setPrize(res.prize);
      setDuplicate(res.duplicate);
      if (res.duplicate) {
        toast(copy.crates.duplicate(res.prize.name, res.refund));
      } else {
        toast.success(copy.crates.won(res.prize.name));
      }
      router.refresh();
    });
  }

  const canAfford = balance >= CRATE_PRICE;

  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <div className="flex items-center gap-2">
          <Gift className="size-5 text-fuchsia-500" />
          <div>
            <p className="font-semibold">{copy.crates.title}</p>
            <p className="text-xs text-muted-foreground">
              {copy.crates.subtitle}
            </p>
          </div>
        </div>

        {prize && (
          <div
            key={prize.id + (duplicate ? "-dup" : "-new")}
            className="flex animate-in fade-in zoom-in-95 flex-col items-center gap-1.5 rounded-lg border border-dashed py-4"
          >
            <PrizePreview prize={prize} />
            <p className="text-sm font-semibold">{prize.name}</p>
            <p
              className={cn(
                "text-xs font-medium",
                RARITY_META[prize.rarity].className,
              )}
            >
              <Sparkles className="mr-1 inline size-3" />
              {RARITY_META[prize.rarity].label} ·{" "}
              {duplicate ? copy.crates.dupLabel : copy.crates.newLabel}
            </p>
          </div>
        )}

        <Button
          className="w-full"
          disabled={pending || !canAfford}
          onClick={open}
        >
          {pending
            ? copy.crates.opening
            : prize
              ? copy.crates.again
              : copy.crates.open(CRATE_PRICE)}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          {copy.crates.odds}
        </p>
        <p className="text-center text-xs text-muted-foreground">
          {copy.crates.hint}
        </p>
      </CardContent>
    </Card>
  );
}
