"use client";

import { useCallback, useEffect, useState } from "react";
import { Coins } from "lucide-react";
import { toast } from "sonner";

import {
  guessHogerLager,
  nextHogerLager,
  type HogerLagerRound,
} from "@/app/_actions/voetbal-modes";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/utils";

type Round = Extract<HogerLagerRound, { ok: true }>;

export function HogerLagerGame({
  roomId,
  onEarned,
}: {
  roomId: string;
  onEarned: (hourEarned: number) => void;
}) {
  const [round, setRound] = useState<Round | null>(null);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    correct: boolean;
    rightValue: number;
  } | null>(null);

  const loadNext = useCallback(
    async (resetStreak: boolean) => {
      const r = await nextHogerLager(roomId);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setRound(r);
      setResult(null);
      if (resetStreak) setStreak(0);
    },
    [roomId],
  );

  useEffect(() => {
    let active = true;
    nextHogerLager(roomId).then((r) => {
      if (!active) return;
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setRound(r);
      setResult(null);
      setStreak(0);
    });
    return () => {
      active = false;
    };
  }, [roomId]);

  async function onChoose(choice: "higher" | "lower") {
    if (!round || result || busy) return;
    setBusy(true);
    const r = await guessHogerLager({ roomId, roundId: round.roundId, choice });
    setBusy(false);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    setResult({ correct: r.correct, rightValue: r.rightValue });
    if (r.correct) {
      const next = streak + 1;
      setStreak(next);
      setBest((b) => Math.max(b, next));
      onEarned(r.hourEarned);
      if (r.coins > 0) toast.success(`${copy.voetbal.hl.correct} +${r.coins}`);
    } else {
      toast.error(copy.voetbal.hl.wrong);
    }
  }

  if (!round) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{copy.voetbal.hl.streak(streak)}</span>
        <span className="text-muted-foreground">{copy.voetbal.hl.best(best)}</span>
      </div>

      <p className="text-center text-sm text-muted-foreground">
        {copy.voetbal.hl.prompt}
      </p>

      <div className="grid grid-cols-2 gap-3">
        <PlayerPanel
          name={round.left.name}
          flag={round.left.flag}
          sub={`${round.left.country} · ${round.left.position}`}
          value={copy.voetbal.hl.value(round.left.value)}
        />
        <PlayerPanel
          name={round.right.name}
          flag={round.right.flag}
          sub={`${round.right.country} · ${round.right.position}`}
          value={
            result ? copy.voetbal.hl.value(result.rightValue) : "❓"
          }
          highlight={result ? (result.correct ? "good" : "bad") : undefined}
        />
      </div>

      {result ? (
        <Button
          className="w-full"
          disabled={busy}
          onClick={() => loadNext(!result.correct)}
        >
          {result.correct ? copy.voetbal.hl.next : copy.voetbal.hl.retry}
        </Button>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => onChoose("higher")}
          >
            {copy.voetbal.hl.higher}
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => onChoose("lower")}
          >
            {copy.voetbal.hl.lower}
          </Button>
        </div>
      )}
    </div>
  );
}

function PlayerPanel({
  name,
  flag,
  sub,
  value,
  highlight,
}: {
  name: string;
  flag: string;
  sub: string;
  value: string;
  highlight?: "good" | "bad";
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-1 rounded-xl border p-4 text-center transition-colors",
        highlight === "good" && "border-emerald-500/40 bg-emerald-500/10",
        highlight === "bad" && "border-destructive/40 bg-destructive/10",
      )}
    >
      <span className="text-3xl" aria-hidden>
        {flag}
      </span>
      <span className="font-semibold leading-tight">{name}</span>
      <span className="text-xs text-muted-foreground">{sub}</span>
      <span className="mt-1 inline-flex items-center gap-1 font-mono text-lg font-bold tabular-nums">
        {value !== "❓" && <Coins className="size-4 text-amber-500" />}
        {value}
      </span>
    </div>
  );
}
