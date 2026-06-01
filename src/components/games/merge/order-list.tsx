"use client";

import { Coins } from "lucide-react";

import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import { itemEmoji } from "@/lib/merge/config";
import type { MergeOrder, MergeState } from "@/lib/merge/types";
import { cn } from "@/lib/utils";

/** Does the board hold an item matching this order? */
function hasItem(state: MergeState, order: MergeOrder): boolean {
  return state.cells.some(
    (c) => c?.kind === "item" && c.family === order.family && c.tier === order.tier,
  );
}

/** The order board — deliver a requested item for a coin reward. */
export function OrderList({
  state,
  pending,
  onDeliver,
}: {
  state: MergeState;
  pending: boolean;
  onDeliver: (orderId: string) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold">{copy.merge.orders}</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {state.orders.map((order) => {
          const ready = hasItem(state, order);
          return (
            <div
              key={order.id}
              className={cn(
                "flex items-center justify-between gap-2 rounded-lg border p-2",
                ready ? "border-emerald-500/50 bg-emerald-500/5" : "opacity-80",
              )}
            >
              <span className="flex items-center gap-1.5">
                <span className="text-2xl leading-none">
                  {itemEmoji(order.family, order.tier)}
                </span>
                <span className="flex items-center gap-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                  <Coins className="size-3" />
                  {copy.merge.reward(order.reward)}
                </span>
              </span>
              <Button
                size="sm"
                variant={ready ? "default" : "outline"}
                disabled={pending || !ready}
                onClick={() => onDeliver(order.id)}
              >
                {copy.merge.deliver}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
