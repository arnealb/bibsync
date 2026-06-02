"use client";

import { useCallback, useEffect, useState } from "react";
import { Eye } from "lucide-react";
import { toast } from "sonner";

import {
  guessMystery,
  nextMystery,
  revealMystery,
  type MysteryRound,
} from "@/app/_actions/voetbal-modes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/utils";

type Round = Extract<MysteryRound, { ok: true }>;

export function MysteryGame({
  roomId,
  onEarned,
}: {
  roomId: string;
  onEarned: (hourEarned: number) => void;
}) {
  const [round, setRound] = useState<Round | null>(null);
  const [visible, setVisible] = useState(1);
  const [guess, setGuess] = useState("");
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<{ name: string; solved: boolean } | null>(
    null,
  );

  const loadNext = useCallback(async () => {
    const r = await nextMystery(roomId);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    setRound(r);
    setVisible(1);
    setGuess("");
    setOutcome(null);
  }, [roomId]);

  useEffect(() => {
    let active = true;
    nextMystery(roomId).then((r) => {
      if (!active || !r.ok) return;
      setRound(r);
      setVisible(1);
      setGuess("");
      setOutcome(null);
    });
    return () => {
      active = false;
    };
  }, [roomId]);

  async function onGuess(e: React.FormEvent) {
    e.preventDefault();
    const text = guess.trim();
    if (!round || outcome || !text || busy) return;
    setBusy(true);
    const r = await guessMystery({ roomId, roundId: round.roundId, guess: text });
    setBusy(false);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    if (r.correct && r.name) {
      setOutcome({ name: r.name, solved: true });
      onEarned(r.hourEarned);
      toast.success(
        r.coins > 0
          ? `${copy.voetbal.mystery.solved(r.name)} +${r.coins}`
          : copy.voetbal.mystery.solved(r.name),
      );
    } else {
      toast.error(copy.voetbal.mystery.wrong);
      setGuess("");
    }
  }

  async function onGiveUp() {
    if (!round || outcome) return;
    const r = await revealMystery(round.roundId);
    if (r.ok) setOutcome({ name: r.name, solved: false });
  }

  if (!round) return null;

  const allShown = visible >= round.clues.length;

  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {round.clues.slice(0, visible).map((clue, i) => (
          <li
            key={i}
            className="rounded-lg border bg-card px-3 py-2 text-sm"
          >
            {clue}
          </li>
        ))}
      </ul>

      {!outcome && !allShown && (
        <Button variant="ghost" size="sm" onClick={() => setVisible((v) => v + 1)}>
          <Eye className="size-4" /> {copy.voetbal.mystery.hint}
        </Button>
      )}

      {outcome ? (
        <div
          className={cn(
            "rounded-xl border p-4 text-center",
            outcome.solved
              ? "border-emerald-500/40 bg-emerald-500/10"
              : "border-border bg-muted/40",
          )}
        >
          <p className="font-semibold">
            {outcome.solved
              ? copy.voetbal.mystery.solved(outcome.name)
              : copy.voetbal.mystery.revealed(outcome.name)}
          </p>
          <Button className="mt-3" disabled={busy} onClick={loadNext}>
            {copy.voetbal.mystery.next}
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <form onSubmit={onGuess} className="flex gap-2">
            <Input
              autoFocus
              value={guess}
              onChange={(e) => setGuess(e.target.value)}
              placeholder={copy.voetbal.mystery.placeholder}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
            />
            <Button type="submit" disabled={busy}>
              {copy.voetbal.mystery.guess}
            </Button>
          </form>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={onGiveUp}
          >
            {copy.voetbal.mystery.giveUp}
          </Button>
        </div>
      )}
    </div>
  );
}
