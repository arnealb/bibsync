"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { placeCrashBet } from "@/app/_actions/crash";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { copy } from "@/lib/copy";
import {
  CRASH_CHIPS,
  CRASH_DEFAULT_TARGET_BP,
  CRASH_MAX_TARGET_BP,
  CRASH_MIN_TARGET_BP,
  CRASH_TARGET_PRESETS,
} from "@/lib/crash/config";
import {
  crashWinChance,
  type CrashResult,
} from "@/lib/crash/engine";
import { cn } from "@/lib/utils";

/** Basis points → "2.00". */
function fmtBp(bp: number): string {
  return (bp / 100).toFixed(2);
}

function clampTarget(bp: number): number {
  return Math.min(CRASH_MAX_TARGET_BP, Math.max(CRASH_MIN_TARGET_BP, Math.round(bp)));
}

export function CrashPanel({
  roomId,
  initialBalance,
}: {
  roomId: string;
  initialBalance: number;
}) {
  const [balance, setBalance] = useState(initialBalance);
  const [bet, setBet] = useState(50);
  const [targetBp, setTargetBp] = useState(CRASH_DEFAULT_TARGET_BP);
  const [displayBp, setDisplayBp] = useState(100);
  const [result, setResult] = useState<CrashResult | null>(null);
  const [flying, setFlying] = useState(false);
  const [recent, setRecent] = useState<CrashResult[]>([]);
  const [pending, start] = useTransition();
  const raf = useRef<number | null>(null);

  // Cancel any in-flight animation frame on unmount.
  useEffect(() => {
    return () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
    };
  }, []);

  const chance = crashWinChance(targetBp);
  const previewPayout = Math.floor((bet * targetBp) / 100);
  const busy = pending || flying;

  /** Animate the multiplier rising to the endpoint, then reveal the result. */
  function animateTo(res: CrashResult) {
    const end = res.win ? res.targetBp : res.crashBp;
    const startedAt = performance.now();
    const duration = Math.min(
      3000,
      Math.max(500, 700 * Math.log2(end / 100 + 1)),
    );
    const tick = (now: number) => {
      const t = Math.min(1, (now - startedAt) / duration);
      // Exponential rise from 1.00x to the endpoint.
      setDisplayBp(Math.max(100, Math.round(100 * (end / 100) ** t)));
      if (t < 1) {
        raf.current = requestAnimationFrame(tick);
        return;
      }
      raf.current = null;
      setFlying(false);
      setResult(res);
      setRecent((prev) => [res, ...prev].slice(0, 6));
      if (res.win) {
        toast.success(copy.crash.resultWin(fmtBp(res.targetBp), res.payout));
      } else {
        toast.error(copy.crash.resultLose(fmtBp(res.crashBp)));
      }
    };
    raf.current = requestAnimationFrame(tick);
  }

  function onLaunch() {
    if (busy) return;
    if (bet < 1) return;
    if (bet > balance) {
      toast.error(copy.crash.cantAfford);
      return;
    }
    start(async () => {
      const res = await placeCrashBet({ roomId, bet, targetBp });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setBalance(res.balance);
      setResult(null);
      setDisplayBp(100);
      setFlying(true);
      animateTo(res.result);
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
              result.win ? "text-emerald-500" : "text-red-500",
            )}
          >
            {result.win
              ? copy.crash.resultWin(fmtBp(result.targetBp), result.payout)
              : copy.crash.resultLose(fmtBp(result.crashBp))}
          </span>
        ) : (
          <span className="text-muted-foreground">{copy.crash.hint}</span>
        )}
      </div>

      {/* Rocket display */}
      <div
        className={cn(
          "relative flex h-44 items-center justify-center overflow-hidden rounded-xl border transition-colors",
          flying
            ? "border-amber-400/40 bg-amber-400/5"
            : result?.win
              ? "border-emerald-500/40 bg-emerald-500/5"
              : result
                ? "border-red-500/40 bg-red-500/5"
                : "bg-muted/20",
        )}
      >
        <div className="text-center">
          <p
            className={cn(
              "font-mono text-5xl font-bold tabular-nums transition-colors",
              flying
                ? "text-amber-400"
                : result?.win
                  ? "text-emerald-500"
                  : result
                    ? "text-red-500"
                    : "text-muted-foreground",
            )}
          >
            {fmtBp(flying || result ? displayBp : targetBp)}×
          </p>
          <p className="mt-1 text-2xl">
            {flying ? "🚀" : result?.win ? "🎉" : result ? "💥" : "🚀"}
          </p>
        </div>
      </div>

      {/* Recent results */}
      {recent.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span>{copy.crash.recent}:</span>
          {recent.map((r, i) => (
            <span
              key={i}
              className={cn(
                "rounded px-1.5 py-0.5 font-semibold tabular-nums",
                r.win
                  ? "bg-emerald-500/15 text-emerald-500"
                  : "bg-red-500/15 text-red-500",
              )}
            >
              {fmtBp(r.crashBp)}×
            </span>
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg border p-2">
          <p className="text-[10px] uppercase text-muted-foreground">
            {copy.crash.targetLabel}
          </p>
          <p className="font-mono text-sm font-semibold tabular-nums">
            {copy.crash.multiplier(targetBp / 100)}
          </p>
        </div>
        <div className="rounded-lg border p-2">
          <p className="text-[10px] uppercase text-muted-foreground">
            {copy.crash.winChanceLabel}
          </p>
          <p className="font-mono text-sm font-semibold tabular-nums">
            {copy.crash.winChance(chance * 100)}
          </p>
        </div>
        <div className="rounded-lg border p-2">
          <p className="text-[10px] uppercase text-muted-foreground">
            {copy.crash.payoutLabel}
          </p>
          <p className="font-mono text-sm font-semibold tabular-nums text-emerald-500">
            {previewPayout}
          </p>
        </div>
      </div>

      {/* Target controls */}
      <div className="space-y-2">
        <Label htmlFor="crash-target">{copy.crash.targetLabel}</Label>
        <div className="flex items-center gap-2">
          <Input
            id="crash-target"
            type="number"
            min={1.01}
            step={0.01}
            value={(targetBp / 100).toFixed(2)}
            disabled={busy}
            onChange={(e) =>
              setTargetBp(clampTarget(Number(e.target.value) * 100))
            }
            className="flex-1"
          />
          {CRASH_TARGET_PRESETS.map((p) => (
            <Button
              key={p}
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => setTargetBp(p)}
            >
              {fmtBp(p)}×
            </Button>
          ))}
        </div>
      </div>

      {/* Bet controls */}
      <div className="space-y-2">
        <Label htmlFor="crash-bet">{copy.crash.betLabel}</Label>
        <Input
          id="crash-bet"
          type="number"
          min={1}
          value={bet}
          disabled={busy}
          onChange={(e) => setBetClamped(Number(e.target.value))}
        />
        <div className="flex flex-wrap items-center gap-2">
          {CRASH_CHIPS.map((c) => (
            <button
              key={c}
              type="button"
              disabled={busy}
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
      </div>

      <Button className="w-full" disabled={busy} onClick={onLaunch}>
        {flying ? copy.crash.launching : copy.crash.launch}
      </Button>
    </div>
  );
}
