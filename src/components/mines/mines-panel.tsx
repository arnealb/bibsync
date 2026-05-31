"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  cashoutMines,
  revealMinesTile,
  startMines,
  type MinesActionResult,
} from "@/app/_actions/mines";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { copy } from "@/lib/copy";
import {
  MINE_COUNT_OPTIONS,
  MINES_CHIPS,
  MINES_GRID_SIZE,
} from "@/lib/mines/config";
import {
  minesMultiplier,
  minesPayout,
  safeTileCount,
  type MinesState,
} from "@/lib/mines/engine";
import { cn } from "@/lib/utils";

const TILES = Array.from({ length: MINES_GRID_SIZE }, (_, i) => i);

export function MinesPanel({
  roomId,
  initialState,
  initialBalance,
}: {
  roomId: string;
  initialState: MinesState | null;
  initialBalance: number;
}) {
  const [state, setState] = useState<MinesState | null>(initialState);
  const [balance, setBalance] = useState(initialBalance);
  const [bet, setBet] = useState(50);
  const [mineCount, setMineCount] = useState(3);
  const [pending, start] = useTransition();

  const active = state?.status === "active";

  function run(fn: () => Promise<MinesActionResult>) {
    start(async () => {
      const result = await fn();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setState(result.state);
      setBalance(result.balance);
      if (result.state.status === "cashed") {
        toast.success(copy.mines.cashedOut(result.state.payout));
      } else if (result.state.status === "busted") {
        toast.error(copy.mines.boom);
      }
    });
  }

  function onStart() {
    if (bet < 1) return;
    if (bet > balance) {
      toast.error(copy.mines.cantAfford);
      return;
    }
    run(() => startMines({ roomId, bet, mineCount }));
  }

  function onReveal(tile: number) {
    if (!active || pending) return;
    if (state?.revealed.includes(tile)) return;
    run(() => revealMinesTile({ roomId, tile }));
  }

  const revealedCount = state?.revealed.length ?? 0;
  const currentValue = state
    ? minesPayout(state.bet, state.mineCount, revealedCount)
    : 0;
  const nextMultiplier = state
    ? minesMultiplier(state.mineCount, revealedCount + 1)
    : 1;
  const safeTotal = state ? safeTileCount(state.mineCount) : 0;

  return (
    <div className="space-y-5">
      {/* Status line */}
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="font-mono tabular-nums text-muted-foreground">
          {copy.bibcoins.balance(balance)}
        </span>
        {active ? (
          <span className="flex items-center gap-3 font-medium">
            <span className="text-emerald-500">
              {copy.mines.multiplier(state!.multiplier)}
            </span>
            <span className="text-muted-foreground">
              {copy.mines.safe(revealedCount, safeTotal)}
            </span>
          </span>
        ) : state?.status === "cashed" ? (
          <span className="font-medium text-emerald-500">
            {copy.mines.cashedOut(state.payout)}
          </span>
        ) : state?.status === "busted" ? (
          <span className="font-medium text-red-500">{copy.mines.boom}</span>
        ) : (
          <span className="text-muted-foreground">{copy.mines.hint}</span>
        )}
      </div>

      {/* Board */}
      <div className="grid grid-cols-5 gap-1.5">
        {TILES.map((tile) => {
          const isRevealed = state?.revealed.includes(tile) ?? false;
          const isMine = state?.mines?.includes(tile) ?? false;
          const isBust = state?.bust === tile;
          const disabled = !active || isRevealed || pending;
          return (
            <button
              key={tile}
              type="button"
              onClick={() => onReveal(tile)}
              disabled={disabled}
              className={cn(
                "flex aspect-square items-center justify-center rounded-md border text-lg font-semibold transition select-none",
                isRevealed && "border-emerald-500/40 bg-emerald-500/15",
                isMine && !isBust && "border-red-500/30 bg-red-500/10",
                isBust && "border-red-500 bg-red-500/25",
                !isRevealed &&
                  !isMine &&
                  active &&
                  "cursor-pointer hover:border-amber-400/60 hover:bg-muted",
                !isRevealed && !isMine && !active && "bg-muted/30",
              )}
            >
              {isRevealed ? "💎" : isMine ? "💣" : ""}
            </button>
          );
        })}
      </div>

      {active ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span className="font-mono tabular-nums">
              {copy.mines.potential(currentValue)}
            </span>
            {revealedCount < safeTotal && (
              <span className="font-mono tabular-nums">
                {copy.mines.nextMultiplier(nextMultiplier)}
              </span>
            )}
          </div>
          <Button
            className="w-full"
            disabled={pending || revealedCount === 0}
            onClick={() => run(() => cashoutMines({ roomId }))}
          >
            {revealedCount === 0
              ? copy.mines.cashoutDisabled
              : copy.mines.cashout(currentValue)}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="mines-bet">{copy.mines.betLabel}</Label>
              <Input
                id="mines-bet"
                type="number"
                min={1}
                max={balance}
                value={bet}
                onChange={(e) =>
                  setBet(Math.max(0, Math.floor(Number(e.target.value) || 0)))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>{copy.mines.minesLabel}</Label>
              <Select
                value={String(mineCount)}
                onValueChange={(v) => setMineCount(Number(v ?? "3"))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MINE_COUNT_OPTIONS.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {copy.mines.minesValue(n)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {MINES_CHIPS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setBet(c)}
                className={cn(
                  "size-9 rounded-full border-2 text-xs font-bold tabular-nums transition",
                  bet === c
                    ? "border-amber-400 bg-amber-400/20 text-amber-500"
                    : "border-border text-muted-foreground hover:border-amber-400/50",
                )}
              >
                {c}
              </button>
            ))}
          </div>

          <Button className="w-full" disabled={pending} onClick={onStart}>
            {state ? copy.mines.newGame : copy.mines.start}
          </Button>
        </div>
      )}
    </div>
  );
}
