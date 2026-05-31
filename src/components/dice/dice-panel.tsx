"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { placeDiceBet } from "@/app/_actions/dice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { copy } from "@/lib/copy";
import {
  DICE_CHIPS,
  DICE_DEFAULT_BP,
  DICE_MAX_BP,
  DICE_MIN_BP,
  DICE_OUTCOMES,
  type DiceDirection,
} from "@/lib/dice/config";
import {
  diceMultiplier,
  diceWinChance,
  type DiceResult,
} from "@/lib/dice/engine";
import { cn } from "@/lib/utils";

/** Basis points → "50.50". */
function fmtBp(bp: number): string {
  return (bp / 100).toFixed(2);
}

/** Clamp a slider value into the allowed target range. */
function clampBp(bp: number): number {
  return Math.min(DICE_MAX_BP, Math.max(DICE_MIN_BP, Math.round(bp)));
}

export function DicePanel({
  roomId,
  initialBalance,
}: {
  roomId: string;
  initialBalance: number;
}) {
  const [balance, setBalance] = useState(initialBalance);
  const [bet, setBet] = useState(50);
  const [targetBp, setTargetBp] = useState(DICE_DEFAULT_BP);
  const [direction, setDirection] = useState<DiceDirection>("over");
  const [result, setResult] = useState<DiceResult | null>(null);
  const [pending, start] = useTransition();

  const chance = diceWinChance(targetBp, direction);
  const multiplier = diceMultiplier(targetBp, direction);
  const previewPayout = Math.floor(bet * multiplier);

  // Thumb sits at target% of the 0..100 track; the win side is green.
  const targetPct = targetBp / 100;
  const winLeft = direction === "under";

  function onRoll() {
    if (bet < 1) return;
    if (bet > balance) {
      toast.error(copy.dice.cantAfford);
      return;
    }
    start(async () => {
      const res = await placeDiceBet({ roomId, bet, targetBp, direction });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setResult(res.result);
      setBalance(res.balance);
      const rollStr = fmtBp(res.result.roll);
      if (res.result.win) {
        toast.success(copy.dice.resultWin(rollStr, res.result.payout));
      } else {
        toast.error(copy.dice.resultLose(rollStr));
      }
    });
  }

  const setBetClamped = (n: number) =>
    setBet(Math.max(1, Math.min(Math.floor(n) || 0, balance || n)));

  return (
    <div className="space-y-5">
      {/* Status line */}
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="font-mono tabular-nums text-muted-foreground">
          {copy.bibcoins.balance(balance)}
        </span>
        {result ? (
          <span
            className={cn(
              "font-medium",
              result.win ? "text-emerald-500" : "text-muted-foreground",
            )}
          >
            {result.win
              ? copy.dice.resultWin(fmtBp(result.roll), result.payout)
              : copy.dice.resultLose(fmtBp(result.roll))}
          </span>
        ) : (
          <span className="text-muted-foreground">{copy.dice.hint}</span>
        )}
      </div>

      {/* Slider + result marker */}
      <div className="rounded-xl border bg-muted/20 p-4 pt-10">
        <div className="relative">
          {/* Result marker */}
          {result && (
            <div
              className="absolute -top-9 z-10 -translate-x-1/2 transition-[left] duration-500 ease-out"
              style={{ left: `${result.roll / 100}%` }}
            >
              <div
                className={cn(
                  "rounded-md px-2 py-0.5 text-xs font-bold tabular-nums text-white shadow",
                  result.win ? "bg-emerald-500" : "bg-red-500",
                )}
              >
                {fmtBp(result.roll)}
              </div>
            </div>
          )}

          {/* Track */}
          <div className="relative h-3 w-full overflow-hidden rounded-full">
            <div
              className={cn(
                "absolute inset-y-0 left-0",
                winLeft ? "bg-emerald-500" : "bg-red-500/80",
              )}
              style={{ width: `${targetPct}%` }}
            />
            <div
              className={cn(
                "absolute inset-y-0 right-0",
                winLeft ? "bg-red-500/80" : "bg-emerald-500",
              )}
              style={{ left: `${targetPct}%` }}
            />
          </div>

          {/* Native range (transparent thumb) for dragging */}
          <input
            type="range"
            min={0}
            max={DICE_OUTCOMES}
            step={1}
            value={targetBp}
            onChange={(e) => setTargetBp(clampBp(Number(e.target.value)))}
            aria-label={copy.dice.title}
            className="absolute inset-x-0 -top-1 h-5 w-full cursor-pointer appearance-none bg-transparent [&::-moz-range-thumb]:size-5 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:rounded-md [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-primary [&::-moz-range-thumb]:bg-background [&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-md [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-primary [&::-webkit-slider-thumb]:bg-background"
          />
        </div>

        <div className="mt-4 flex justify-between text-[10px] text-muted-foreground tabular-nums">
          <span>0</span>
          <span>25</span>
          <span>50</span>
          <span>75</span>
          <span>100</span>
        </div>
        <p className="mt-1 text-center font-mono text-lg font-semibold tabular-nums">
          {fmtBp(targetBp)}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg border p-2">
          <p className="text-[10px] uppercase text-muted-foreground">
            {copy.dice.multiplierLabel}
          </p>
          <p className="font-mono text-sm font-semibold tabular-nums">
            {copy.dice.multiplier(multiplier)}
          </p>
        </div>
        <div className="rounded-lg border p-2">
          <p className="text-[10px] uppercase text-muted-foreground">
            {copy.dice.winChanceLabel}
          </p>
          <p className="font-mono text-sm font-semibold tabular-nums">
            {copy.dice.winChance(chance * 100)}
          </p>
        </div>
        <div className="rounded-lg border p-2">
          <p className="text-[10px] uppercase text-muted-foreground">
            {copy.dice.payoutLabel}
          </p>
          <p className="font-mono text-sm font-semibold tabular-nums text-emerald-500">
            {previewPayout}
          </p>
        </div>
      </div>

      {/* Direction toggle */}
      <div className="grid grid-cols-2 gap-2">
        {(["under", "over"] as const).map((dir) => (
          <button
            key={dir}
            type="button"
            onClick={() => setDirection(dir)}
            className={cn(
              "rounded-lg border py-2 text-sm font-medium transition",
              direction === dir
                ? "border-primary bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            {dir === "under" ? copy.dice.under : copy.dice.over}{" "}
            {fmtBp(targetBp)}
          </button>
        ))}
      </div>

      {/* Bet controls */}
      <div className="space-y-2">
        <Label htmlFor="dice-bet">{copy.dice.betLabel}</Label>
        <div className="flex items-center gap-2">
          <Input
            id="dice-bet"
            type="number"
            min={1}
            value={bet}
            onChange={(e) => setBetClamped(Number(e.target.value))}
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setBetClamped(Math.floor(bet / 2))}
          >
            {copy.dice.half}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setBetClamped(bet * 2)}
          >
            {copy.dice.double}
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {DICE_CHIPS.map((c) => (
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
      </div>

      <Button className="w-full" disabled={pending} onClick={onRoll}>
        {pending ? copy.dice.rolling : copy.dice.roll}
      </Button>
    </div>
  );
}
