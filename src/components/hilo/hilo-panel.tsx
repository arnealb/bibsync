"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronUp } from "lucide-react";

import { cashoutHilo, guessHilo, startHilo } from "@/app/_actions/hilo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { copy } from "@/lib/copy";
import {
  cardLabel,
  hiloPayout,
  optionMultiplier,
  winChance,
  type HiloDirection,
  type HiloState,
} from "@/lib/hilo/engine";
import { HILO_CHIPS } from "@/lib/hilo/config";
import { cn } from "@/lib/utils";

export function HiloPanel({
  roomId,
  initialState,
  initialBalance,
}: {
  roomId: string;
  initialState: HiloState | null;
  initialBalance: number;
}) {
  const [state, setState] = useState<HiloState | null>(initialState);
  const [balance, setBalance] = useState(initialBalance);
  const [bet, setBet] = useState(50);
  const [pending, start] = useTransition();

  const active = state?.status === "active";
  const card = state?.current ?? 0;

  function run(
    fn: () => Promise<
      { ok: true; state: HiloState; balance: number } | { ok: false; error: string }
    >,
  ) {
    start(async () => {
      const res = await fn();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setState(res.state);
      setBalance(res.balance);
      if (res.state.status === "cashed") {
        toast.success(copy.hilo.cashedOut(res.state.payout));
      } else if (res.state.status === "busted") {
        toast.error(copy.hilo.busted(cardLabel(res.state.revealed ?? 0)));
      }
    });
  }

  function onStart() {
    if (bet < 1) return;
    if (bet > balance) {
      toast.error(copy.hilo.cantAfford);
      return;
    }
    run(() => startHilo({ roomId, bet }));
  }

  function guess(direction: HiloDirection) {
    if (!active || pending) return;
    run(() => guessHilo({ roomId, direction }));
  }

  const higherMult = active ? optionMultiplier("higher", card) : 0;
  const lowerMult = active ? optionMultiplier("lower", card) : 0;
  const currentValue = state ? hiloPayout(state.bet, state.multiplier) : 0;

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
              {copy.hilo.multiplier(state!.multiplier)}
            </span>
            <span className="text-muted-foreground">
              {copy.hilo.streak(state!.streak)}
            </span>
          </span>
        ) : state?.status === "cashed" ? (
          <span className="font-medium text-emerald-500">
            {copy.hilo.cashedOut(state.payout)}
          </span>
        ) : state?.status === "busted" ? (
          <span className="font-medium text-red-500">
            {copy.hilo.busted(cardLabel(state.revealed ?? 0))}
          </span>
        ) : (
          <span className="text-muted-foreground">{copy.hilo.hint}</span>
        )}
      </div>

      {/* Card */}
      <div className="mx-auto flex h-44 w-32 items-center justify-center rounded-2xl border-2 bg-card shadow-lg">
        <span className="font-mono text-6xl font-bold">
          {state ? cardLabel(card) : "?"}
        </span>
      </div>

      {active ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Button
              className="h-auto flex-col gap-0.5 bg-emerald-600 py-3 hover:bg-emerald-500"
              disabled={pending || higherMult === 0}
              onClick={() => guess("higher")}
            >
              <span className="flex items-center gap-1 font-semibold">
                <ChevronUp className="size-4" />
                {copy.hilo.higher}
              </span>
              <span className="text-xs opacity-90">
                {higherMult > 0
                  ? `${copy.hilo.multiplier(higherMult)} · ${copy.hilo.chance(winChance("higher", card) * 100)}`
                  : "—"}
              </span>
            </Button>
            <Button
              className="h-auto flex-col gap-0.5 bg-sky-600 py-3 hover:bg-sky-500"
              disabled={pending || lowerMult === 0}
              onClick={() => guess("lower")}
            >
              <span className="flex items-center gap-1 font-semibold">
                <ChevronDown className="size-4" />
                {copy.hilo.lower}
              </span>
              <span className="text-xs opacity-90">
                {lowerMult > 0
                  ? `${copy.hilo.multiplier(lowerMult)} · ${copy.hilo.chance(winChance("lower", card) * 100)}`
                  : "—"}
              </span>
            </Button>
          </div>
          <Button
            variant="outline"
            className="w-full"
            disabled={pending || (state?.streak ?? 0) === 0}
            onClick={() => run(() => cashoutHilo(roomId))}
          >
            {copy.hilo.cashout(currentValue)}
          </Button>
        </>
      ) : (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="hilo-bet">{copy.hilo.betLabel}</Label>
            <Input
              id="hilo-bet"
              type="number"
              min={1}
              value={bet}
              onChange={(e) =>
                setBet(Math.max(0, Math.floor(Number(e.target.value) || 0)))
              }
            />
            <div className="flex flex-wrap items-center gap-2">
              {HILO_CHIPS.map((c) => (
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
          <Button className="w-full" disabled={pending} onClick={onStart}>
            {state ? copy.hilo.newGame : copy.hilo.start}
          </Button>
        </div>
      )}
    </div>
  );
}
