"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { playKeno } from "@/app/_actions/keno";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { copy } from "@/lib/copy";
import {
  KENO_CHIPS,
  KENO_MAX_PICKS,
  KENO_MIN_BET,
  KENO_PAYTABLE,
  KENO_POOL,
} from "@/lib/keno/config";
import type { KenoResult } from "@/lib/keno/engine";
import { cn } from "@/lib/utils";

const NUMBERS = Array.from({ length: KENO_POOL }, (_, i) => i + 1);

export function KenoPanel({
  roomId,
  initialBalance,
}: {
  roomId: string;
  initialBalance: number;
}) {
  const [balance, setBalance] = useState(initialBalance);
  const [bet, setBet] = useState(50);
  const [picks, setPicks] = useState<number[]>([]);
  const [result, setResult] = useState<KenoResult | null>(null);
  const [pending, start] = useTransition();

  const drawn = new Set(result?.drawn ?? []);
  const hitSet = new Set(result?.hits ?? []);

  function toggle(n: number) {
    if (pending) return;
    setResult(null);
    setPicks((prev) =>
      prev.includes(n)
        ? prev.filter((p) => p !== n)
        : prev.length >= KENO_MAX_PICKS
          ? prev
          : [...prev, n],
    );
  }

  function quickPick() {
    if (pending) return;
    setResult(null);
    const pool = [...NUMBERS];
    const out: number[] = [];
    const count = picks.length || 6;
    for (let i = 0; i < count; i++) {
      const j = Math.floor(Math.random() * pool.length);
      out.push(pool.splice(j, 1)[0]);
    }
    setPicks(out.sort((a, b) => a - b));
  }

  function play() {
    if (picks.length === 0) {
      toast.error(copy.keno.needPick);
      return;
    }
    if (bet < KENO_MIN_BET || bet > balance) {
      toast.error(copy.keno.cantAfford);
      return;
    }
    start(async () => {
      const res = await playKeno({ roomId, bet, picks });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setResult(res.result);
      setBalance(res.balance);
      if (res.result.payout > 0) {
        toast.success(
          copy.keno.resultWin(res.result.multiplier, res.result.payout),
        );
      } else {
        toast.error(copy.keno.resultLose);
      }
    });
  }

  // Paytable preview for the current pick count.
  const table = KENO_PAYTABLE[picks.length] ?? [];

  return (
    <div className="space-y-4">
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
            {copy.keno.hits(result.hits.length, result.picks.length)} ·{" "}
            {result.payout > 0
              ? copy.keno.resultWin(result.multiplier, result.payout)
              : copy.keno.resultLose}
          </span>
        ) : (
          <span className="text-muted-foreground">
            {copy.keno.pickHint(picks.length, KENO_MAX_PICKS)}
          </span>
        )}
      </div>

      {/* Number grid */}
      <div className="grid grid-cols-8 gap-1.5">
        {NUMBERS.map((n) => {
          const picked = picks.includes(n);
          const isDrawn = drawn.has(n);
          const isHit = hitSet.has(n);
          return (
            <button
              key={n}
              type="button"
              onClick={() => toggle(n)}
              className={cn(
                "flex aspect-square items-center justify-center rounded-md border text-sm font-semibold tabular-nums transition",
                isHit
                  ? "border-emerald-500 bg-emerald-500 text-white"
                  : picked && isDrawn
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : picked
                      ? "border-primary bg-primary/20 text-primary"
                      : isDrawn
                        ? "border-amber-400 bg-amber-400/20 text-amber-600 dark:text-amber-400"
                        : "border-border hover:bg-muted",
              )}
            >
              {n}
            </button>
          );
        })}
      </div>

      {/* Paytable preview */}
      {table.length > 0 && (
        <div className="flex flex-wrap gap-1 text-[10px] text-muted-foreground">
          {table.map((m, h) =>
            m > 0 ? (
              <span key={h} className="rounded bg-muted px-1.5 py-0.5 tabular-nums">
                {h} raak → {m}×
              </span>
            ) : null,
          )}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={pending} onClick={quickPick}>
          {copy.keno.random}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={pending || picks.length === 0}
          onClick={() => {
            setPicks([]);
            setResult(null);
          }}
        >
          {copy.keno.clear}
        </Button>
      </div>

      {/* Bet */}
      <div className="space-y-2">
        <Label htmlFor="keno-bet">{copy.keno.betLabel}</Label>
        <Input
          id="keno-bet"
          type="number"
          min={KENO_MIN_BET}
          value={bet}
          onChange={(e) =>
            setBet(Math.max(0, Math.floor(Number(e.target.value) || 0)))
          }
        />
        <div className="flex flex-wrap items-center gap-2">
          {KENO_CHIPS.map((c) => (
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

      <Button className="w-full" disabled={pending} onClick={play}>
        {pending ? copy.keno.playing : copy.keno.play}
      </Button>
    </div>
  );
}
