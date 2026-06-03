"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { rollMexenDice } from "@/app/_actions/mexen";
import { MexenDie } from "@/components/mexen/mexen-die";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { copy } from "@/lib/copy";
import { MEXEN_MAX_THROWS } from "@/lib/mexen/config";
import type { MexenFinal, MexenPlayer } from "@/lib/mexen/game";
import { cn } from "@/lib/utils";

export function MexenRound({
  roomId,
  order,
  roundNo,
  totalRounds,
  honderdmanName,
  onComplete,
}: {
  roomId: string;
  order: MexenPlayer[];
  roundNo: number;
  totalRounds: number;
  honderdmanName: string | null;
  onComplete: (finals: MexenFinal[]) => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [throwsAllowed, setThrowsAllowed] = useState<number | null>(null);
  const [dice, setDice] = useState<[number | null, number | null]>([null, null]);
  const [kept, setKept] = useState<[boolean, boolean]>([false, false]);
  const [throwsUsed, setThrowsUsed] = useState(0);
  const [finals, setFinals] = useState<MexenFinal[]>([]);
  const [pending, start] = useTransition();

  const current = order[currentIndex];
  const cap = currentIndex === 0 ? MEXEN_MAX_THROWS : (throwsAllowed ?? MEXEN_MAX_THROWS);
  const hasRolled = throwsUsed > 0;
  const canRoll = throwsUsed < cap;
  const canKeep = hasRolled && throwsUsed < cap;
  const throwsLeft = cap - throwsUsed;

  function roll() {
    start(async () => {
      const res = await rollMexenDice({ roomId });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const [r0, r1] = res.dice;
      setDice(([d0, d1]) => [
        kept[0] && d0 !== null ? d0 : r0,
        kept[1] && d1 !== null ? d1 : r1,
      ]);
      setKept([false, false]);
      setThrowsUsed((n) => n + 1);
    });
  }

  function toggleKeep(i: 0 | 1) {
    if (!canKeep) return;
    setKept((prev) => {
      const next: [boolean, boolean] = [...prev];
      next[i] = !next[i];
      return next;
    });
  }

  function endTurn() {
    if (!hasRolled || dice[0] === null || dice[1] === null) return;
    const final: MexenFinal = { playerId: current.id, dice: [dice[0], dice[1]] };
    const nextFinals = [...finals, final];
    if (currentIndex === 0 && throwsAllowed === null) {
      setThrowsAllowed(throwsUsed);
    }
    if (currentIndex + 1 >= order.length) {
      onComplete(nextFinals);
      return;
    }
    setFinals(nextFinals);
    setCurrentIndex((i) => i + 1);
    setDice([null, null]);
    setKept([false, false]);
    setThrowsUsed(0);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="font-medium">{copy.mexen.round(roundNo, totalRounds)}</span>
        {honderdmanName && (
          <span className="text-muted-foreground">
            {copy.mexen.honderdman(honderdmanName)}
          </span>
        )}
      </div>

      {/* Turn-order strip */}
      <div className="flex flex-wrap items-center gap-1.5">
        {order.map((p, i) => (
          <span
            key={p.id}
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-medium",
              i === currentIndex
                ? "bg-primary text-primary-foreground"
                : i < currentIndex
                  ? "bg-muted text-muted-foreground line-through"
                  : "bg-muted text-muted-foreground",
            )}
          >
            {p.name}
          </span>
        ))}
      </div>

      {/* Current player */}
      <div className="flex flex-col items-center gap-3 rounded-xl border bg-muted/20 p-5">
        <div className="flex items-center gap-2">
          <UserAvatar
            name={current.name}
            avatarUrl={current.avatarUrl}
            loadout={current.loadout}
            className="size-8"
          />
          <span className="font-semibold">{copy.mexen.turnOf(current.name)}</span>
        </div>

        <div className="flex gap-3">
          <MexenDie
            value={dice[0]}
            kept={kept[0]}
            onClick={canKeep ? () => toggleKeep(0) : undefined}
          />
          <MexenDie
            value={dice[1]}
            kept={kept[1]}
            onClick={canKeep ? () => toggleKeep(1) : undefined}
          />
        </div>

        <p className="text-xs text-muted-foreground">
          {currentIndex === 0 && throwsAllowed === null
            ? copy.mexen.firstSetsThrows
            : copy.mexen.throwsLeft(throwsLeft)}
        </p>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        {copy.mexen.rollHint}
      </p>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" disabled={pending || !canRoll} onClick={roll}>
          {pending
            ? copy.mexen.rolling
            : hasRolled
              ? copy.mexen.reroll
              : copy.mexen.roll}
        </Button>
        <Button disabled={pending || !hasRolled} onClick={endTurn}>
          {copy.mexen.stop}
        </Button>
      </div>
    </div>
  );
}
