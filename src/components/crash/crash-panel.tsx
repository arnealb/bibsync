"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { cashoutCrash, peekCrash, startCrash } from "@/app/_actions/crash";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { copy } from "@/lib/copy";
import { CRASH_CHIPS } from "@/lib/crash/config";
import {
  crashMultiplierAtMs,
  type CrashRoundState,
} from "@/lib/crash/engine";
import { cn } from "@/lib/utils";

/** Basis points → "2.41". */
function fmtBp(bp: number): string {
  return (bp / 100).toFixed(2);
}

/** How often we ask the server whether the rocket has crashed. */
const POLL_MS = 250;

type Phase = "idle" | "running" | "done";

export function CrashPanel({
  roomId,
  initialBalance,
}: {
  roomId: string;
  initialBalance: number;
}) {
  const [balance, setBalance] = useState(initialBalance);
  const [bet, setBet] = useState(50);
  const [phase, setPhase] = useState<Phase>("idle");
  const [displayBp, setDisplayBp] = useState(100);
  const [result, setResult] = useState<CrashRoundState | null>(null);
  const [recent, setRecent] = useState<{ bp: number; win: boolean }[]>([]);
  const [pending, setPending] = useState(false);

  const raf = useRef<number | null>(null);
  const poll = useRef<number | null>(null);
  const startedAt = useRef(0);
  const offset = useRef(0); // server clock − client clock
  const running = useRef(false);
  const cashing = useRef(false);

  function stopTimers() {
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    if (poll.current !== null) window.clearInterval(poll.current);
    raf.current = null;
    poll.current = null;
  }

  useEffect(() => stopTimers, []);

  function elapsedMs(): number {
    return Date.now() + offset.current - startedAt.current;
  }

  /** Settle the round in the UI (from the authoritative server result). */
  function finish(state: CrashRoundState) {
    if (!running.current) return;
    running.current = false;
    stopTimers();
    setPhase("done");
    setResult(state);
    if (state.payout > 0) setBalance((b) => b + state.payout);
    setDisplayBp(state.cashoutBp ?? state.crashBp ?? 100);
    setRecent((prev) =>
      [
        { bp: state.crashBp ?? 100, win: state.status === "cashed" },
        ...prev,
      ].slice(0, 6),
    );
    if (state.status === "cashed") {
      toast.success(
        copy.crash.resultWin(fmtBp(state.cashoutBp ?? 100), state.payout),
      );
    } else {
      toast.error(copy.crash.resultLose(fmtBp(state.crashBp ?? 100)));
    }
  }

  /** Cash out at the multiplier shown the instant of the click (or poll-crash). */
  function cashOut() {
    if (!running.current || cashing.current) return;
    cashing.current = true;
    const claimedBp = crashMultiplierAtMs(elapsedMs());
    void cashoutCrash({ roomId, claimedBp }).then((res) => {
      cashing.current = false;
      if (!res.ok) {
        if (running.current) toast.error(res.error);
        return;
      }
      finish(res.state);
    });
  }

  function onLaunch() {
    if (running.current || pending) return;
    if (bet < 1) return;
    if (bet > balance) {
      toast.error(copy.crash.cantAfford);
      return;
    }
    setPending(true);
    void startCrash({ roomId, bet }).then((res) => {
      setPending(false);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      running.current = true;
      cashing.current = false;
      setBalance(res.balance);
      setResult(null);
      setDisplayBp(100);
      setPhase("running");
      startedAt.current = Date.parse(res.state.startedAt);
      offset.current = Date.parse(res.state.serverNow) - Date.now();

      const tick = () => {
        setDisplayBp(crashMultiplierAtMs(elapsedMs()));
        raf.current = requestAnimationFrame(tick);
      };
      raf.current = requestAnimationFrame(tick);

      // Read-only crash poll: when it reports a crash, auto-cash (→ busts).
      poll.current = window.setInterval(() => {
        void peekCrash(roomId).then((p) => {
          if (p.ok && p.crashed) cashOut();
        });
      }, POLL_MS);
    });
  }

  const isRunning = phase === "running";
  const liveBp = isRunning
    ? displayBp
    : (result?.cashoutBp ?? result?.crashBp ?? displayBp);
  const potential = Math.floor((bet * displayBp) / 100);
  const crashed = phase === "done" && result?.status === "busted";

  const setBetClamped = (n: number) =>
    setBet(Math.max(1, Math.min(Math.floor(n) || 0, balance || n)));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="font-mono tabular-nums text-muted-foreground">
          {copy.bibcoins.balance(balance)}
        </span>
        {phase === "done" && result ? (
          <span
            className={cn(
              "font-medium",
              result.status === "cashed" ? "text-emerald-500" : "text-red-500",
            )}
          >
            {result.status === "cashed"
              ? copy.crash.resultWin(fmtBp(result.cashoutBp ?? 100), result.payout)
              : copy.crash.resultLose(fmtBp(result.crashBp ?? 100))}
          </span>
        ) : (
          <span className="text-muted-foreground">{copy.crash.hint}</span>
        )}
      </div>

      {/* Rocket display */}
      <div
        className={cn(
          "relative flex h-48 items-center justify-center overflow-hidden rounded-xl border transition-colors",
          isRunning
            ? "border-amber-400/40 bg-amber-400/5"
            : result?.status === "cashed"
              ? "border-emerald-500/40 bg-emerald-500/5"
              : crashed
                ? "border-red-500/40 bg-red-500/5"
                : "bg-muted/20",
        )}
      >
        <div className="text-center">
          <p
            className={cn(
              "font-mono text-6xl font-bold tabular-nums transition-colors",
              isRunning
                ? "text-amber-400"
                : result?.status === "cashed"
                  ? "text-emerald-500"
                  : crashed
                    ? "text-red-500"
                    : "text-muted-foreground",
            )}
          >
            {fmtBp(liveBp)}×
          </p>
          <p className="mt-1 text-3xl">
            {isRunning ? "🚀" : result?.status === "cashed" ? "🎉" : crashed ? "💥" : "🚀"}
          </p>
        </div>
      </div>

      {/* Recent crash points */}
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
              {fmtBp(r.bp)}×
            </span>
          ))}
        </div>
      )}

      {/* Action: cash out while running, else launch */}
      {isRunning ? (
        <Button
          className="w-full bg-emerald-600 hover:bg-emerald-500"
          onClick={cashOut}
        >
          {copy.crash.cashout(fmtBp(displayBp))} ({potential})
        </Button>
      ) : (
        <>
          <div className="space-y-2">
            <Label htmlFor="crash-bet">{copy.crash.betLabel}</Label>
            <Input
              id="crash-bet"
              type="number"
              min={1}
              value={bet}
              onChange={(e) => setBetClamped(Number(e.target.value))}
            />
            <div className="flex flex-wrap items-center gap-2">
              {CRASH_CHIPS.map((c) => (
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
          <Button className="w-full" disabled={pending} onClick={onLaunch}>
            {copy.crash.launch}
          </Button>
        </>
      )}
    </div>
  );
}
