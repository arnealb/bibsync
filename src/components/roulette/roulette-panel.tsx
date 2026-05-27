"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  placeRouletteBet,
  resolveRoulette,
  startRouletteRound,
  type RouletteActionResult,
} from "@/app/_actions/roulette";
import { RouletteWheel, rotationFor } from "@/components/roulette/roulette-wheel";
import { UserAvatar } from "@/components/user-avatar";
import { copy } from "@/lib/copy";
import type { MemberMap } from "@/lib/members";
import {
  ROULETTE_CHIPS,
  ROULETTE_RESULT_MS,
  ROULETTE_SPIN_MS,
} from "@/lib/roulette/config";
import { colorOf, type BetType } from "@/lib/roulette/engine";
import { useRouletteRealtime } from "@/hooks/use-roulette-realtime";
import {
  stakeFor,
  type RouletteTable,
} from "@/lib/roulette/table";
import { cn } from "@/lib/utils";

/** Module-scope clock read so render stays pure (no Date.now in render). */
function now(): number {
  return Date.now();
}

const CELL_COLOR: Record<string, string> = {
  red: "bg-red-600 hover:bg-red-500",
  black: "bg-neutral-900 hover:bg-neutral-800",
  green: "bg-emerald-700 hover:bg-emerald-600",
};

function spotKey(type: BetType, value?: number): string {
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
        <span className="absolute -top-1 -right-1 flex min-w-4 items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-bold text-black tabular-nums shadow">
          {amount}
        </span>
      )}
    </button>
  );
}

export function RoulettePanel({
  roomId,
  userId,
  members,
  initialState,
  initialBalance,
}: {
  roomId: string;
  userId: string;
  members: MemberMap;
  initialState: RouletteTable | null;
  initialBalance: number;
}) {
  const [table, setTable] = useState<RouletteTable | null>(initialState);
  const [balance, setBalance] = useState(initialBalance);
  const [chip, setChip] = useState<number>(50);
  const [rotation, setRotation] = useState(0);
  const [nowTs, setNowTs] = useState(0);
  // Which round's outcome has finished spinning and may be shown. A state we
  // load straight into (mid-result) counts as revealed — there's no spin to wait for.
  const [revealedRound, setRevealedRound] = useState<number | null>(
    initialState?.phase === "result" ? initialState.roundNo : null,
  );
  const [pending, start] = useTransition();

  const animatedRound = useRef<number | null>(null);
  const resolvedRound = useRef<number | null>(null);
  const startedRound = useRef<number | null>(null);

  // Spin the wheel exactly once when a fresh result arrives (in the realtime
  // handler, never in an effect/render).
  useRouletteRealtime(roomId, (state) => {
    setTable(state);
    if (
      state.phase === "result" &&
      state.winningNumber != null &&
      animatedRound.current !== state.roundNo
    ) {
      animatedRound.current = state.roundNo;
      const n = state.winningNumber;
      setRotation((r) => rotationFor(r, n));
    }
  });

  // Tick a clock for the countdown.
  useEffect(() => {
    const id = window.setInterval(() => setNowTs(now()), 250);
    return () => window.clearInterval(id);
  }, []);

  const phase = table?.phase ?? "betting";
  const endsAt = table?.bettingEndsAt ? Date.parse(table.bettingEndsAt) : null;
  const roundNo = table?.roundNo ?? 0;
  // The outcome is only shown once the wheel has stopped on this round.
  const revealed = phase === "result" && revealedRound === roundNo;
  const secondsLeft =
    endsAt != null && nowTs > 0 ? Math.max(0, Math.ceil((endsAt - nowTs) / 1000)) : null;

  // When the timer is up, any client resolves the round (idempotent server-side).
  useEffect(() => {
    if (
      phase === "betting" &&
      endsAt != null &&
      nowTs > 0 &&
      nowTs >= endsAt &&
      resolvedRound.current !== roundNo
    ) {
      resolvedRound.current = roundNo;
      void resolveRoulette(roomId);
    }
  }, [phase, endsAt, nowTs, roundNo, roomId]);

  // Reveal the outcome only after the wheel has finished spinning, so you
  // can't tell whether you've won before it stops.
  useEffect(() => {
    if (phase !== "result" || revealedRound === roundNo) return;
    const id = window.setTimeout(
      () => setRevealedRound(roundNo),
      ROULETTE_SPIN_MS,
    );
    return () => window.clearTimeout(id);
  }, [phase, roundNo, revealedRound]);

  // After showing the result, open the next round (idempotent server-side).
  useEffect(() => {
    if (phase !== "result" || startedRound.current === roundNo) return;
    startedRound.current = roundNo;
    const id = window.setTimeout(() => {
      void startRouletteRound(roomId);
    }, ROULETTE_RESULT_MS);
    return () => window.clearTimeout(id);
  }, [phase, roundNo, roomId]);

  function run(fn: () => Promise<RouletteActionResult>) {
    start(async () => {
      const result = await fn();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (typeof result.balance === "number") setBalance(result.balance);
    });
  }

  const bets = table?.bets ?? [];
  const amountOn = (type: BetType, value?: number) =>
    bets
      .filter((b) => spotKey(b.type, b.value) === spotKey(type, value))
      .reduce((sum, b) => sum + b.amount, 0);
  const myStake = stakeFor(bets, userId);
  const myResult = table?.results?.find((r) => r.userId === userId) ?? null;
  const betting = phase === "betting";
  const locked = !betting || secondsLeft === 0 || pending;

  function place(type: BetType, value?: number) {
    if (locked || chip > balance) {
      if (chip > balance) toast.error(copy.roulette.cantAfford);
      return;
    }
    run(() => placeRouletteBet({ roomId, bet: { type, value, amount: chip } }));
  }

  // Numbers laid out 3 rows × 12 cols (top row 3, 6, …, 36).
  const numbers = [0, 1, 2].flatMap((r) =>
    Array.from({ length: 12 }, (_, c) => c * 3 + (3 - r)),
  );

  return (
    <div className="space-y-5">
      <RouletteWheel rotation={rotation} />

      {/* Status line */}
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="font-mono tabular-nums text-muted-foreground">
          {copy.bibcoins.balance(balance)}
        </span>
        {revealed && table?.winningNumber != null ? (
          <span
            className={cn(
              "font-medium",
              myResult && myResult.payout > 0
                ? "text-emerald-500"
                : "text-muted-foreground",
            )}
          >
            {copy.roulette.winningNumber(table.winningNumber)} —{" "}
            {myResult && myResult.payout > 0
              ? copy.roulette.yourResultWin(myResult.payout)
              : myStake > 0 || (myResult?.staked ?? 0) > 0
                ? copy.roulette.yourResultLose
                : ""}
          </span>
        ) : phase === "result" ? (
          <span className="font-mono font-semibold tabular-nums text-amber-500">
            {copy.roulette.spinning}
          </span>
        ) : secondsLeft != null ? (
          <span className="font-mono font-semibold tabular-nums text-amber-500">
            {copy.roulette.bettingEndsIn(secondsLeft)}
          </span>
        ) : (
          <span className="text-muted-foreground">
            {copy.roulette.waitingFirstBet}
          </span>
        )}
      </div>

      {revealed &&
        table?.results &&
        table.results.length > 0 && (
          <ul className="space-y-1 rounded-lg border p-2 text-sm">
            {table.results.map((r) => (
              <li key={r.userId} className="flex items-center gap-2">
                <UserAvatar
                  name={members[r.userId]?.name ?? "—"}
                  avatarUrl={members[r.userId]?.avatarUrl}
                  className="size-5"
                  fallbackClassName="text-[9px]"
                />
                <span className="min-w-0 flex-1 truncate">
                  {members[r.userId]?.name ?? "—"}
                </span>
                <span
                  className={cn(
                    "font-mono tabular-nums",
                    r.payout > 0 ? "text-emerald-500" : "text-muted-foreground",
                  )}
                >
                  {r.payout > 0 ? `+${r.payout}` : `−${r.staked}`}
                </span>
              </li>
            ))}
          </ul>
        )}

      {revealed && (
        <p className="text-center text-xs text-muted-foreground">
          {copy.roulette.nextRound}
        </p>
      )}

      {/* Betting table */}
      <div className="overflow-x-auto">
        <div className="min-w-[420px] space-y-1">
          <div className="flex gap-1">
            <Spot
              label="0"
              amount={amountOn("straight", 0)}
              disabled={locked}
              onClick={() => place("straight", 0)}
              className="w-8 shrink-0 self-stretch bg-emerald-700 hover:bg-emerald-600"
            />
            <div className="grid flex-1 grid-cols-12 gap-1">
              {numbers.map((n) => (
                <Spot
                  key={n}
                  label={n}
                  amount={amountOn("straight", n)}
                  disabled={locked}
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
                disabled={locked}
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
                disabled={locked}
                onClick={() => place(col)}
                className="h-8 bg-muted/40"
              />
            ))}
          </div>

          <div className="grid grid-cols-6 gap-1">
            <Spot label={copy.roulette.labels.low} amount={amountOn("low")} disabled={locked} onClick={() => place("low")} className="h-8 bg-muted/40" />
            <Spot label={copy.roulette.labels.even} amount={amountOn("even")} disabled={locked} onClick={() => place("even")} className="h-8 bg-muted/40" />
            <Spot label={copy.roulette.labels.red} amount={amountOn("red")} disabled={locked} onClick={() => place("red")} className="h-8 bg-red-600 hover:bg-red-500" />
            <Spot label={copy.roulette.labels.black} amount={amountOn("black")} disabled={locked} onClick={() => place("black")} className="h-8 bg-neutral-900 hover:bg-neutral-800" />
            <Spot label={copy.roulette.labels.odd} amount={amountOn("odd")} disabled={locked} onClick={() => place("odd")} className="h-8 bg-muted/40" />
            <Spot label={copy.roulette.labels.high} amount={amountOn("high")} disabled={locked} onClick={() => place("high")} className="h-8 bg-muted/40" />
          </div>
        </div>
      </div>

      {/* Chips */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">{copy.roulette.chip}:</span>
        {ROULETTE_CHIPS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setChip(c)}
            disabled={locked}
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
        {myStake > 0 && (
          <span className="ml-auto font-mono text-sm tabular-nums text-muted-foreground">
            {copy.roulette.yourStake(myStake)}
          </span>
        )}
      </div>
    </div>
  );
}
