import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Coins } from "lucide-react";

import { ShopPanel } from "@/components/bibcoins/shop-panel";
import { getBibcoins } from "@/lib/bibcoins/queries";
import { getLoadout, getOwnedCosmetics } from "@/lib/cosmetics/queries";
import { copy } from "@/lib/copy";
import { getAuthContext } from "@/lib/auth";

export const metadata: Metadata = { title: copy.bibcoins.shop.title };

export default async function ShopPage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");

  const [balance, owned, loadout] = await Promise.all([
    getBibcoins(ctx.user.id),
    getOwnedCosmetics(ctx.user.id),
    getLoadout(ctx.user.id),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {copy.bibcoins.shop.title}
          </h1>
          <p className="text-sm text-muted-foreground">
            {copy.bibcoins.shop.subtitle}
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-sm font-semibold tabular-nums">
          <Coins className="size-4 text-amber-500" />
          {balance}
        </span>
      </div>
      <ShopPanel balance={balance} owned={owned} loadout={loadout} />
    </div>
  );
}
