"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";

import { spinWheelBet } from "@/app/_actions/wheel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { copy } from "@/lib/copy";
import {
  WHEEL_CHIPS,
  WHEEL_MIN_BET,
  WHEEL_RISKS,
  wheelColor,
  type WheelRisk,
} from "@/lib/wheel/config";
import { wheelSegments, type WheelResult } from "@/lib/wheel/engine";
import { cn } from "@/lib/utils";

const SPIN_MS = 4000;

/** Absolute rotation that lands segment `index` (of `n`) under the top pointer. */
function landingRotation(from: number, index: number, n: number): number {
  const seg = 360 / n;
  const targetMod = (360 - index * seg) % 360;
  const currentMod = ((from % 360) + 360) % 360;
  const delta = (targetMod - currentMod + 360) % 360;
  return from + 360 * 5 + delta;
}

export function WheelPanel({
  roomId,
  initialBalance,
}: {
  roomId: string;
  initialBalance: number;
}) {
  const [balance, setBalance] = useState(initialBalance);
  const [bet, setBet] = useState(50);
  const [risk, setRisk] = useState<WheelRisk>("medium");
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<WheelResult | null>(null);
  const [revealed, setRevealed] = useState(false);
  const reveal = useRef<number | null>(null);

  const segments = wheelSegments(risk);
  const n = segments.length;
  const seg = 360 / n;
  const conic = `conic-gradient(from ${-seg / 2}deg, ${segments
    .map((m, i) => `${wheelColor(m)} ${i * seg}deg ${(i + 1) * seg}deg`)
    .join(", ")})`;

  function onSpin() {
    if (spinning) return;
    if (bet < WHEEL_MIN_BET) return;
    if (bet > balance) {
      toast.error(copy.wheel.cantAfford);
      return;
    }
    setSpinning(true);
    setRevealed(false);
    void spinWheelBet({ roomId, bet, risk }).then((res) => {
      if (!res.ok) {
        setSpinning(false);
        toast.error(res.error);
        return;
      }
      setResult(res.result);
      setRotation((r) => landingRotation(r, res.result.index, n));
      if (reveal.current) window.clearTimeout(reveal.current);
      reveal.current = window.setTimeout(() => {
        setSpinning(false);
        setRevealed(true);
        setBalance(res.balance);
        if (res.result.payout > 0) {
          toast.success(
            copy.wheel.resultWin(res.result.multiplier, res.result.payout),
          );
        } else {
          toast.error(copy.wheel.resultLose);
        }
      }, SPIN_MS);
    });
  }

  const setBetClamped = (v: number) =>
    setBet(Math.max(0, Math.min(Math.floor(v) || 0, balance || v)));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="font-mono tabular-nums text-muted-foreground">
          {copy.bibcoins.balance(balance)}
        </span>
        {revealed && result ? (
          <span
            className={cn(
              "font-medium",
              result.payout > 0 ? "text-emerald-500" : "text-muted-foreground",
            )}
          >
            {result.payout > 0
              ? copy.wheel.resultWin(result.multiplier, result.payout)
              : copy.wheel.resultLose}
          </span>
        ) : (
          <span className="text-muted-foreground">
            {spinning ? copy.wheel.spinning : copy.wheel.hint}
          </span>
        )}
      </div>

      {/* Wheel */}
      <div className="relative mx-auto aspect-square w-60 max-w-full">
        <div className="absolute left-1/2 top-0 z-20 size-0 -translate-x-1/2 border-x-8 border-t-[16px] border-x-transparent border-t-amber-400 drop-shadow" />
        <div
          className="absolute inset-0 rounded-full border-[6px] border-amber-700/60 shadow-2xl"
          style={{
            backgroundImage: `${conic}, repeating-conic-gradient(from ${-seg / 2}deg, rgba(0,0,0,0.5) 0deg 0.6deg, transparent 0.6deg ${seg}deg)`,
            transform: `rotate(${rotation}deg)`,
            transition: spinning
              ? `transform ${SPIN_MS}ms cubic-bezier(0.15, 0.85, 0.2, 1)`
              : "none",
          }}
        />
        <div className="absolute left-1/2 top-1/2 z-10 flex size-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 border-amber-700/60 bg-background">
          <span className="font-mono text-lg font-bold tabular-nums">
            {revealed && result ? `${result.multiplier}×` : "🎡"}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="wheel-bet">{copy.wheel.betLabel}</Label>
          <Input
            id="wheel-bet"
            type="number"
            min={WHEEL_MIN_BET}
            value={bet}
            disabled={spinning}
            onChange={(e) => setBetClamped(Number(e.target.value))}
          />
        </div>
        <div className="space-y-1.5">
          <Label>{copy.wheel.riskLabel}</Label>
          <div className="flex gap-1">
            {WHEEL_RISKS.map((r) => (
              <button
                key={r}
                type="button"
                disabled={spinning}
                onClick={() => setRisk(r)}
                className={cn(
                  "flex-1 rounded-md border py-2 text-xs font-medium transition disabled:opacity-60",
                  risk === r
                    ? "border-primary bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                {copy.wheel.risks[r]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {WHEEL_CHIPS.map((c) => (
          <button
            key={c}
            type="button"
            disabled={spinning}
            onClick={() => setBet(c)}
            className={cn(
              "size-9 rounded-full border-2 text-xs font-bold tabular-nums transition disabled:opacity-60",
              bet === c
                ? "border-amber-400 bg-amber-400/20 text-amber-500"
                : "border-border text-muted-foreground hover:border-amber-400/50",
            )}
          >
            {c}
          </button>
        ))}
      </div>

      <Button className="w-full" disabled={spinning} onClick={onSpin}>
        {spinning ? copy.wheel.spinning : copy.wheel.spin}
      </Button>
    </div>
  );
}
