"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { buyCosmetic, equipCosmetic } from "@/app/_actions/cosmetics";
import { Button } from "@/components/ui/button";
import {
  COSMETIC_TYPES,
  TYPE_COLUMN,
  cosmeticsByType,
  type CosmeticItem,
} from "@/lib/cosmetics/catalog";
import { effectClassName } from "@/lib/cosmetics/effects";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/utils";
import type { UserLoadout } from "@/types/database";

const RAINBOW =
  "conic-gradient(from 0deg, #ef4444, #f59e0b, #eab308, #22c55e, #38bdf8, #a855f7, #ec4899, #ef4444)";

function Preview({ item }: { item: CosmeticItem }) {
  if (item.type === "frame") {
    return (
      <span
        className="inline-flex size-9 items-center justify-center rounded-full p-[3px]"
        style={{ background: item.value === "rainbow" ? RAINBOW : item.value }}
      >
        <span className="size-full rounded-full bg-muted" />
      </span>
    );
  }
  if (item.type === "color") {
    return (
      <span className="text-lg font-bold" style={{ color: item.value }}>
        Aa
      </span>
    );
  }
  if (item.type === "effect") {
    return (
      <span className={cn("text-lg font-bold", effectClassName(item.value))}>
        Aa
      </span>
    );
  }
  if (item.type === "title") {
    return (
      <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap">
        {item.value}
      </span>
    );
  }
  return <span className="text-2xl leading-none">{item.value}</span>;
}

export function ShopPanel({
  balance,
  owned,
  loadout,
}: {
  balance: number;
  owned: string[];
  loadout: UserLoadout | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const ownedSet = new Set(owned);

  const equippedId = (type: CosmeticItem["type"]) =>
    (loadout as Record<string, string | null> | null)?.[TYPE_COLUMN[type]] ??
    null;

  function run(action: () => Promise<{ ok: boolean; error?: string }>, okMsg?: string) {
    start(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error ?? copy.bibcoins.shop.error);
        return;
      }
      if (okMsg) toast.success(okMsg);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {COSMETIC_TYPES.map((type) => {
        const items = cosmeticsByType(type);
        if (items.length === 0) return null;
        return (
          <section key={type} className="space-y-2">
            <h2 className="text-sm font-semibold tracking-tight">
              {copy.bibcoins.cosmeticTypes[type]}
            </h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {items.map((item) => {
                const isOwned = ownedSet.has(item.id);
                const isEquipped = equippedId(type) === item.id;
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 rounded-lg border p-3"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center">
                      <Preview item={item} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {copy.bibcoins.balance(item.price)}
                      </p>
                    </div>
                    {!isOwned ? (
                      <Button
                        size="sm"
                        disabled={pending || balance < item.price}
                        onClick={() =>
                          run(
                            () => buyCosmetic(item.id),
                            copy.bibcoins.shop.bought,
                          )
                        }
                      >
                        {copy.bibcoins.shop.buy}
                      </Button>
                    ) : isEquipped ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={pending}
                        onClick={() =>
                          run(() => equipCosmetic({ type, itemId: null }))
                        }
                      >
                        {copy.bibcoins.shop.unequip}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() =>
                          run(() => equipCosmetic({ type, itemId: item.id }))
                        }
                      >
                        {copy.bibcoins.shop.equip}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
