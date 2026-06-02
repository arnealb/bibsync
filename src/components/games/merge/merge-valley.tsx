"use client";

import { useState, useTransition } from "react";
import { Coins, Zap } from "lucide-react";
import { toast } from "sonner";

import {
  mergeBuyEnergy,
  mergeFulfill,
  mergeMove,
  mergeTap,
  type MergeActionResult,
} from "@/app/_actions/merge";
import { BoardGrid } from "@/components/games/merge/board-grid";
import { OrderList } from "@/components/games/merge/order-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { copy } from "@/lib/copy";
import {
  ENERGY_MAX,
  ENERGY_REFILL_AMOUNT,
  ENERGY_REFILL_COST,
} from "@/lib/merge/config";
import type { MergeState } from "@/lib/merge/types";

export function MergeValley({
  roomId,
  initialState,
  initialBalance,
}: {
  roomId: string;
  initialState: MergeState;
  initialBalance: number;
}) {
  const [state, setState] = useState(initialState);
  const [balance, setBalance] = useState(initialBalance);
  const [selected, setSelected] = useState<number | null>(null);
  const [pending, start] = useTransition();

  function run(
    action: () => Promise<MergeActionResult>,
    onOk?: (res: Extract<MergeActionResult, { ok: true }>) => void,
  ) {
    start(async () => {
      const res = await action();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setState(res.state);
      setBalance(res.balance);
      onOk?.(res);
    });
  }

  function handleCellClick(i: number) {
    if (pending) return;
    const cell = state.cells[i];

    if (cell?.kind === "gen") {
      setSelected(null);
      run(() => mergeTap({ roomId }));
      return;
    }

    if (selected === null) {
      if (cell?.kind === "item") setSelected(i);
      return;
    }

    if (selected === i) {
      setSelected(null);
      return;
    }

    const from = selected;
    setSelected(null);
    run(() => mergeMove({ roomId, from, to: i }));
  }

  function deliver(orderId: string) {
    run(
      () => mergeFulfill({ roomId, orderId }),
      (res) => toast.success(copy.merge.delivered(res.awarded ?? 0)),
    );
  }

  const energyPct = Math.round((state.energy / ENERGY_MAX) * 100);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 pt-6">
          {/* Energy + balance */}
          <div className="flex items-center justify-between gap-3 text-sm">
            <div className="flex-1">
              <div className="mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1 font-medium">
                  <Zap className="size-4 text-amber-500" />
                  {copy.merge.energy}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {state.energy} / {ENERGY_MAX}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-amber-500 transition-all"
                  style={{ width: `${energyPct}%` }}
                />
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={pending || balance < ENERGY_REFILL_COST}
              onClick={() => run(() => mergeBuyEnergy({ roomId }))}
            >
              <Zap className="size-3.5 text-amber-500" />
              {copy.merge.buyEnergy(ENERGY_REFILL_AMOUNT, ENERGY_REFILL_COST)}
            </Button>
          </div>

          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Coins className="size-3.5 text-amber-500" />
            <span className="font-medium tabular-nums text-foreground">{balance}</span>
            <span className="ml-auto">{copy.merge.selectHint}</span>
          </p>

          <BoardGrid
            cells={state.cells}
            selected={selected}
            pending={pending}
            onCellClick={handleCellClick}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <OrderList state={state} pending={pending} onDeliver={deliver} />
        </CardContent>
      </Card>

      <p className="px-1 text-xs text-muted-foreground">{copy.merge.hint}</p>
    </div>
  );
}
