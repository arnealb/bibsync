"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { dropPlinko, type PlinkoActionResult } from "@/app/_actions/plinko";
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
  PLINKO_CHIPS,
  PLINKO_RISKS,
  PLINKO_ROWS_OPTIONS,
  plinkoMultiplierColor,
  type PlinkoRisk,
  type PlinkoRows,
} from "@/lib/plinko/config";
import {
  plinkoMultipliers,
  type PlinkoDir,
  type PlinkoResult,
} from "@/lib/plinko/engine";
import { cn } from "@/lib/utils";

/** Step duration of the falling-ball animation (ms per row). */
const STEP_MS = 110;
/** Fraction of the board half-width the outermost slot reaches. */
const HALF = 0.46;

/** Centred lattice x for `rights` rights after `step` bounces, as a percent. */
function latticeX(rows: number, step: number, rights: number): number {
  const x = 2 * rights - step;
  return 50 + (x / rows) * HALF * 100;
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
  const [pending, start] = useTransition();

  // Latest drop (with the post-payout balance to apply once it lands).
  const [drop, setDrop] = useState<{
    result: PlinkoResult;
    balance: number;
    id: number;
  } | null>(null);
  const [step, setStep] = useState(0);
  const [landed, setLanded] = useState(false);
  const [recent, setRecent] = useState<number[]>([]);
  const dropId = useRef(0);

  const animating = drop !== null && !landed;
  const busy = pending || animating;

  // Animate the ball one row per tick; bank the result when it lands. Step/
  // landed are reset in the drop handler (an event), never synchronously here.
  useEffect(() => {
    if (!drop) return;
    let k = 0;
    const id = window.setInterval(() => {
      k += 1;
      setStep(k);
      if (k >= drop.result.rows) {
        window.clearInterval(id);
        setLanded(true);
        setBalance(drop.balance);
        setRecent((prev) => [drop.result.multiplier, ...prev].slice(0, 6));
        if (drop.result.payout > 0) {
          toast.success(
            copy.plinko.landedWin(drop.result.multiplier, drop.result.payout),
          );
        }
      }
    }, STEP_MS);
    return () => window.clearInterval(id);
  }, [drop]);

  function onDrop() {
    if (busy) return;
    if (bet < 1) return;
    if (bet > balance) {
      toast.error(copy.plinko.cantAfford);
      return;
    }
    start(async () => {
      const result: PlinkoActionResult = await dropPlinko({
        roomId,
        bet,
        rows,
        risk,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      dropId.current += 1;
      setStep(0);
      setLanded(false);
      setDrop({
        result: result.result,
        balance: result.balance,
        id: dropId.current,
      });
    });
  }

  // Active board geometry comes from the in-flight drop, else the chosen rows.
  const boardRows = drop?.result.rows ?? rows;
  const boardRisk = drop?.result.risk ?? risk;
  const multipliers = plinkoMultipliers(boardRows, boardRisk);

  // Ball position: rights so far along the known path, mapped to the lattice.
  const path: PlinkoDir[] = drop?.result.path ?? [];
  const rightsSoFar = path.slice(0, step).filter((d) => d === "R").length;
  const ballLeft = latticeX(boardRows, step, rightsSoFar);
  const ballTop = (step / boardRows) * 86 + 3;
  const landedSlot = landed ? drop?.result.slot : null;

  // Decorative peg lattice.
  const pegs: { left: number; top: number; key: string }[] = [];
  for (let i = 1; i <= boardRows; i++) {
    for (let p = 0; p <= i; p++) {
      pegs.push({
        left: latticeX(boardRows, i, p),
        top: (i / boardRows) * 86 + 3,
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
        {landed && drop ? (
          <span
            className={cn(
              "font-medium",
              drop.result.payout > 0
                ? "text-emerald-500"
                : "text-muted-foreground",
            )}
          >
            {drop.result.payout > 0
              ? copy.plinko.landedWin(drop.result.multiplier, drop.result.payout)
              : copy.plinko.landedLose(drop.result.multiplier)}
          </span>
        ) : animating ? (
          <span className="font-mono font-semibold tabular-nums text-amber-500">
            {copy.plinko.dropping}
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
        {drop && (
          <span
            className="absolute z-10 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-400 shadow-[0_0_8px_2px_rgba(251,191,36,0.5)]"
            style={{
              left: `${ballLeft}%`,
              top: `${ballTop}%`,
              transition: `left ${STEP_MS}ms ease-in, top ${STEP_MS}ms linear`,
            }}
            aria-hidden
          />
        )}
      </div>

      {/* Multiplier slots */}
      <div className="flex gap-0.5">
        {multipliers.map((m, j) => (
          <div
            key={j}
            className={cn(
              "flex flex-1 items-center justify-center rounded-sm py-1 text-[10px] font-bold tabular-nums text-black transition sm:text-xs",
              plinkoMultiplierColor(m),
              landedSlot === j && "ring-2 ring-white ring-offset-1 ring-offset-background",
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
              max={balance}
              value={bet}
              disabled={busy}
              onChange={(e) =>
                setBet(Math.max(0, Math.floor(Number(e.target.value) || 0)))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label>{copy.plinko.riskLabel}</Label>
            <Select
              value={risk}
              disabled={busy}
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

        <div className="space-y-1.5">
          <Label>{copy.plinko.rowsLabel}</Label>
          <Select
            value={String(rows)}
            disabled={busy}
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

        <div className="flex flex-wrap items-center gap-2">
          {PLINKO_CHIPS.map((c) => (
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

        <Button className="w-full" disabled={busy} onClick={onDrop}>
          {animating ? copy.plinko.dropping : copy.plinko.drop}
        </Button>
      </div>
    </div>
  );
}
