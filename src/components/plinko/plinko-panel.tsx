"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { dropPlinko } from "@/app/_actions/plinko";
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
  PLINKO_BALL_COUNTS,
  PLINKO_CHIPS,
  PLINKO_MAX_BALLS,
  PLINKO_RISKS,
  PLINKO_ROWS_OPTIONS,
  plinkoMultiplierColor,
  type PlinkoRisk,
  type PlinkoRows,
} from "@/lib/plinko/config";
import { plinkoMultipliers, type PlinkoResult } from "@/lib/plinko/engine";
import { cn } from "@/lib/utils";

/** Animation timing. */
const STEP_MS = 110; // per row the ball falls
const STAGGER_MS = 180; // between consecutive ball launches in one drop
const REST_MS = 500; // how long a landed ball rests in its slot

interface Ball {
  id: number;
  result: PlinkoResult;
  step: number;
}

/** Centred lattice x for `rights` rights after `step` bounces, as a percent. */
function latticeX(rows: number, step: number, rights: number): number {
  const x = 2 * rights - step;
  return 50 + (x / rows) * 0.46 * 100;
}

export function PlinkoPanel({
  roomId,
  initialBalance,
}: {
  roomId: string;
  initialBalance: number;
}) {
  const [balance, setBalance] = useState(initialBalance);
  const [bet, setBet] = useState(50);
  const [rows, setRows] = useState<PlinkoRows>(12);
  const [risk, setRisk] = useState<PlinkoRisk>("medium");
  const [ballCount, setBallCount] = useState(1);
  const [balls, setBalls] = useState<Ball[]>([]);
  const [recent, setRecent] = useState<number[]>([]);
  const [lastResult, setLastResult] = useState<PlinkoResult | null>(null);

  // Running balance is authoritative for spend-gating; `balance` only mirrors
  // it for display. Deltas (−bet on launch, +payout on land) stay exact under
  // many balls in flight, where per-call server snapshots would race.
  const balanceRef = useRef(initialBalance);
  const ballId = useRef(0);
  const timers = useRef(new Map<number, number>());

  // Clear every running timer on unmount (no setState here → effect-safe).
  useEffect(() => {
    const map = timers.current;
    return () => {
      for (const t of map.values()) window.clearInterval(t);
      map.clear();
    };
  }, []);

  function adjustBalance(delta: number) {
    balanceRef.current += delta;
    setBalance(balanceRef.current);
  }

  /** Drive one ball down the board, then settle its payout. */
  function animateBall(ball: Ball) {
    let step = 0;
    const id = window.setInterval(() => {
      step += 1;
      const current = step;
      setBalls((prev) =>
        prev.map((b) => (b.id === ball.id ? { ...b, step: current } : b)),
      );
      if (current >= ball.result.rows) {
        window.clearInterval(id);
        timers.current.delete(ball.id);
        adjustBalance(ball.result.payout);
        setRecent((prev) => [ball.result.multiplier, ...prev].slice(0, 8));
        setLastResult(ball.result);
        if (ball.result.payout > 0) {
          toast.success(
            copy.plinko.landedWin(ball.result.multiplier, ball.result.payout),
          );
        }
        // Let it rest in the slot a beat before clearing.
        window.setTimeout(
          () => setBalls((prev) => prev.filter((b) => b.id !== ball.id)),
          REST_MS,
        );
      }
    }, STEP_MS);
    timers.current.set(ball.id, id);
  }

  /** Stake one ball (optimistic spend, reverted on failure). */
  async function launchBall(): Promise<boolean> {
    if (balanceRef.current < bet) return false;
    adjustBalance(-bet);
    const res = await dropPlinko({ roomId, bet, rows, risk });
    if (!res.ok) {
      adjustBalance(bet);
      toast.error(res.error);
      return false;
    }
    ballId.current += 1;
    const ball: Ball = { id: ballId.current, result: res.result, step: 0 };
    setBalls((prev) => [...prev, ball]);
    animateBall(ball);
    return true;
  }

  /** Launch `ballCount` balls staggered, so they cascade instead of dumping. */
  function onDrop() {
    if (bet < 1) return;
    if (balanceRef.current < bet) {
      toast.error(copy.plinko.cantAfford);
      return;
    }
    const count = Math.min(Math.max(ballCount, 1), PLINKO_MAX_BALLS);
    let launched = 0;
    const tick = () => {
      if (launched >= count || balanceRef.current < bet) return;
      launched += 1;
      void launchBall();
      if (launched < count) window.setTimeout(tick, STAGGER_MS);
    };
    tick();
  }

  const multipliers = plinkoMultipliers(rows, risk);
  const inFlight = balls.length > 0;

  // Decorative peg lattice for the chosen board.
  const pegs: { left: number; top: number; key: string }[] = [];
  for (let i = 1; i <= rows; i++) {
    for (let p = 0; p <= i; p++) {
      pegs.push({
        left: latticeX(rows, i, p),
        top: (i / rows) * 86 + 3,
        key: `${i}-${p}`,
      });
    }
  }

  return (
    <div className="space-y-5">
      {/* Status line */}
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="font-mono tabular-nums text-muted-foreground">
          {copy.bibcoins.balance(balance)}
        </span>
        {inFlight ? (
          <span className="font-mono font-semibold tabular-nums text-amber-500">
            {copy.plinko.inFlight(balls.length)}
          </span>
        ) : lastResult ? (
          <span
            className={cn(
              "font-medium",
              lastResult.payout > 0
                ? "text-emerald-500"
                : "text-muted-foreground",
            )}
          >
            {lastResult.payout > 0
              ? copy.plinko.landedWin(lastResult.multiplier, lastResult.payout)
              : copy.plinko.landedLose(lastResult.multiplier)}
          </span>
        ) : (
          <span className="text-muted-foreground">{copy.plinko.hint}</span>
        )}
      </div>

      {/* Board */}
      <div className="relative w-full overflow-hidden rounded-xl border bg-muted/20 pb-[78%]">
        {pegs.map((peg) => (
          <span
            key={peg.key}
            className="absolute size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground/25"
            style={{ left: `${peg.left}%`, top: `${peg.top}%` }}
            aria-hidden
          />
        ))}
        {balls.map((ball) => {
          const rights = ball.result.path
            .slice(0, ball.step)
            .filter((d) => d === "R").length;
          return (
            <span
              key={ball.id}
              className="absolute z-10 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-400 shadow-[0_0_8px_2px_rgba(251,191,36,0.5)]"
              style={{
                left: `${latticeX(rows, ball.step, rights)}%`,
                top: `${(ball.step / rows) * 86 + 3}%`,
                transition: `left ${STEP_MS}ms ease-in, top ${STEP_MS}ms linear`,
              }}
              aria-hidden
            />
          );
        })}
      </div>

      {/* Multiplier slots */}
      <div className="flex gap-0.5">
        {multipliers.map((m, j) => (
          <div
            key={j}
            className={cn(
              "flex flex-1 items-center justify-center rounded-sm py-1 text-[10px] font-bold tabular-nums text-black sm:text-xs",
              plinkoMultiplierColor(m),
            )}
          >
            {m}
          </div>
        ))}
      </div>

      {/* Recent results */}
      {recent.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span>{copy.plinko.recent}:</span>
          {recent.map((m, i) => (
            <span
              key={i}
              className={cn(
                "rounded px-1.5 py-0.5 font-semibold tabular-nums text-black",
                plinkoMultiplierColor(m),
              )}
            >
              {copy.plinko.multiplier(m)}
            </span>
          ))}
        </div>
      )}

      {/* Controls */}
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="plinko-bet">{copy.plinko.betLabel}</Label>
            <Input
              id="plinko-bet"
              type="number"
              min={1}
              value={bet}
              onChange={(e) =>
                setBet(Math.max(0, Math.floor(Number(e.target.value) || 0)))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label>{copy.plinko.ballsLabel}</Label>
            <Select
              value={String(ballCount)}
              onValueChange={(v) => setBallCount(Number(v ?? "1"))}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLINKO_BALL_COUNTS.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {copy.plinko.ballsValue(n)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>{copy.plinko.rowsLabel}</Label>
            <Select
              value={String(rows)}
              disabled={inFlight}
              onValueChange={(v) => setRows(Number(v ?? "12") as PlinkoRows)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLINKO_ROWS_OPTIONS.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {copy.plinko.rowsValue(n)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{copy.plinko.riskLabel}</Label>
            <Select
              value={risk}
              disabled={inFlight}
              onValueChange={(v) => setRisk((v ?? "medium") as PlinkoRisk)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLINKO_RISKS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {copy.plinko.risks[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {PLINKO_CHIPS.map((c) => (
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

        {/* Always enabled — spam it; each press launches `ballCount` balls. */}
        <Button className="w-full" onClick={onDrop}>
          {copy.plinko.dropN(ballCount)}
        </Button>
      </div>
    </div>
  );
}
