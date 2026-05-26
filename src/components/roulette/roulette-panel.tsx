"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { spinRoulette } from "@/app/_actions/roulette";
import { RouletteWheel, rotationFor } from "@/components/roulette/roulette-wheel";
import { Button } from "@/components/ui/button";
import { colorOf, type Bet, type BetType } from "@/lib/roulette/engine";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/utils";

const CHIPS = [10, 50, 100, 500];
const SPIN_MS = 4200;

const CELL_COLOR: Record<string, string> = {
  red: "bg-red-600 hover:bg-red-500",
  black: "bg-neutral-900 hover:bg-neutral-800",
  green: "bg-emerald-700 hover:bg-emerald-600",
};

function betKey(type: BetType, value?: number): string {
  return type === "straight" ? `s${value}` : type;
}

function Spot({
  label,
  amount,
  disabled,
  onClick,
  className,
}: {
  label: React.ReactNode;
  amount: number;
  disabled: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "relative flex items-center justify-center rounded-sm border border-white/10 text-xs font-semibold text-white transition disabled:opacity-60",
        className,
      )}
    >
      {label}
      {amount > 0 && (
        <span className="absolute -right-1 -top-1 flex min-w-4 items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-bold text-black tabular-nums shadow">
          {amount}
        </span>
      )}
    </button>
  );
}

export function RoulettePanel({ initialBalance }: { initialBalance: number }) {
  const router = useRouter();
  const [bets, setBets] = useState<Map<string, Bet>>(new Map());
  const [chip, setChip] = useState(50);
  const [balance, setBalance] = useState(initialBalance);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<{ number: number; payout: number } | null>(
    null,
  );
  const [, startAction] = useTransition();

  const totalBet = [...bets.values()].reduce((s, b) => s + b.amount, 0);
  const amountOn = (type: BetType, value?: number) =>
    bets.get(betKey(type, value))?.amount ?? 0;

  function place(type: BetType, value?: number) {
    if (spinning) return;
    setResult(null);
    setBets((prev) => {
      const next = new Map(prev);
      const key = betKey(type, value);
      next.set(key, {
        type,
        value,
        amount: (next.get(key)?.amount ?? 0) + chip,
      });
      return next;
    });
  }

  function clear() {
    if (!spinning) setBets(new Map());
  }

  function spin() {
    const list = [...bets.values()];
    if (list.length === 0 || spinning) return;
    if (totalBet > balance) {
      toast.error(copy.roulette.cantAfford);
      return;
    }
    setSpinning(true);
    setResult(null);
    startAction(async () => {
      const res = await spinRoulette(list);
      if (!res.ok) {
        toast.error(res.error);
        setSpinning(false);
        return;
      }
      setRotation((r) => rotationFor(r, res.number));
      window.setTimeout(() => {
        setSpinning(false);
        setResult({ number: res.number, payout: res.payout });
        setBalance(res.balance);
        setBets(new Map());
        router.refresh();
      }, SPIN_MS);
    });
  }

  // Numbers laid out 3 rows × 12 cols (top row 3,6,…,36).
  const numbers = [0, 1, 2].flatMap((r) =>
    Array.from({ length: 12 }, (_, c) => c * 3 + (3 - r)),
  );

  return (
    <div className="space-y-5">
      <RouletteWheel rotation={rotation} />

      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="font-mono tabular-nums text-muted-foreground">
          {copy.bibcoins.balance(balance)}
        </span>
        {result ? (
          <span
            className={cn(
              "font-medium",
              result.payout > 0 ? "text-emerald-500" : "text-muted-foreground",
            )}
          >
            {result.payout > 0
              ? copy.roulette.resultWin(result.number, result.payout)
              : copy.roulette.resultLose(result.number)}
          </span>
        ) : (
          totalBet > 0 && (
            <span className="font-mono tabular-nums">
              {copy.roulette.totalBet(totalBet)}
            </span>
          )
        )}
      </div>

      {/* Betting table */}
      <div className="overflow-x-auto">
        <div className="min-w-[420px] space-y-1">
          <div className="flex gap-1">
            <Spot
              label="0"
              amount={amountOn("straight", 0)}
              disabled={spinning}
              onClick={() => place("straight", 0)}
              className="w-8 shrink-0 self-stretch bg-emerald-700 hover:bg-emerald-600"
            />
            <div className="grid flex-1 grid-cols-12 gap-1">
              {numbers.map((n) => (
                <Spot
                  key={n}
                  label={n}
                  amount={amountOn("straight", n)}
                  disabled={spinning}
                  onClick={() => place("straight", n)}
                  className={cn("h-9", CELL_COLOR[colorOf(n)])}
                />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1">
            {(["dozen1", "dozen2", "dozen3"] as const).map((d) => (
              <Spot
                key={d}
                label={copy.roulette.labels[d]}
                amount={amountOn(d)}
                disabled={spinning}
                onClick={() => place(d)}
                className="h-8 bg-muted/40"
              />
            ))}
          </div>

          <div className="grid grid-cols-3 gap-1">
            {(["col1", "col2", "col3"] as const).map((col) => (
              <Spot
                key={col}
                label={copy.roulette.labels.column}
                amount={amountOn(col)}
                disabled={spinning}
                onClick={() => place(col)}
                className="h-8 bg-muted/40"
              />
            ))}
          </div>

          <div className="grid grid-cols-6 gap-1">
            <Spot label={copy.roulette.labels.low} amount={amountOn("low")} disabled={spinning} onClick={() => place("low")} className="h-8 bg-muted/40" />
            <Spot label={copy.roulette.labels.even} amount={amountOn("even")} disabled={spinning} onClick={() => place("even")} className="h-8 bg-muted/40" />
            <Spot label={copy.roulette.labels.red} amount={amountOn("red")} disabled={spinning} onClick={() => place("red")} className="h-8 bg-red-600 hover:bg-red-500" />
            <Spot label={copy.roulette.labels.black} amount={amountOn("black")} disabled={spinning} onClick={() => place("black")} className="h-8 bg-neutral-900 hover:bg-neutral-800" />
            <Spot label={copy.roulette.labels.odd} amount={amountOn("odd")} disabled={spinning} onClick={() => place("odd")} className="h-8 bg-muted/40" />
            <Spot label={copy.roulette.labels.high} amount={amountOn("high")} disabled={spinning} onClick={() => place("high")} className="h-8 bg-muted/40" />
          </div>
        </div>
      </div>

      {/* Chips */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">{copy.roulette.chip}:</span>
        {CHIPS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setChip(c)}
            disabled={spinning}
            className={cn(
              "size-9 rounded-full border-2 text-xs font-bold tabular-nums transition",
              chip === c
                ? "border-amber-400 bg-amber-400/20 text-amber-500"
                : "border-border text-muted-foreground hover:border-amber-400/50",
            )}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          className="flex-1 bg-emerald-600 text-white hover:bg-emerald-700"
          disabled={spinning || totalBet === 0}
          onClick={spin}
        >
          {spinning ? copy.roulette.spinning : copy.roulette.spin}
        </Button>
        <Button
          variant="outline"
          disabled={spinning || totalBet === 0}
          onClick={clear}
        >
          {copy.roulette.clear}
        </Button>
      </div>
    </div>
  );
}
