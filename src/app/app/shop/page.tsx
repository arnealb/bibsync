import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Coins, Sparkles } from "lucide-react";

import { CrateBox } from "@/components/bibcoins/crate-box";
import { ShopPanel } from "@/components/bibcoins/shop-panel";
import { QuestBoard } from "@/components/quests/quest-board";
import { Button } from "@/components/ui/button";
import { getBibcoins } from "@/lib/bibcoins/queries";
import { getLoadout, getOwnedCosmetics } from "@/lib/cosmetics/queries";
import { copy } from "@/lib/copy";
import { getDailyQuests, getDailyStreak } from "@/lib/quests/queries";
import { getAuthContext } from "@/lib/auth";

export const metadata: Metadata = { title: copy.bibcoins.shop.title };

export default async function ShopPage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");

  const [balance, owned, loadout, quests, streak] = await Promise.all([
    getBibcoins(ctx.user.id),
    getOwnedCosmetics(ctx.user.id),
    getLoadout(ctx.user.id),
    getDailyQuests(ctx.user.id),
    getDailyStreak(ctx.user.id),
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
      <Button
        variant="outline"
        className="w-full"
        render={<Link href="/app/shop/earn" />}
        nativeButton={false}
      >
        <Sparkles className="size-4 text-amber-500" />
        {copy.bibcoins.earn.button}
      </Button>
      <QuestBoard initialQuests={quests} streak={streak} />
      <CrateBox balance={balance} />
      <ShopPanel balance={balance} owned={owned} loadout={loadout} />
    </div>
  );
}
