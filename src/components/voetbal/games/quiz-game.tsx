"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  answerQuiz,
  nextQuiz,
  type QuizRound,
} from "@/app/_actions/voetbal-modes";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/utils";

type Round = Extract<QuizRound, { ok: true }>;

export function QuizGame({
  roomId,
  onEarned,
}: {
  roomId: string;
  onEarned: (hourEarned: number) => void;
}) {
  const [round, setRound] = useState<Round | null>(null);
  const [score, setScore] = useState(0);
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<{ chosen: number; correctId: number } | null>(
    null,
  );

  const loadNext = useCallback(async () => {
    const r = await nextQuiz(roomId);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    setRound(r);
    setAnswer(null);
  }, [roomId]);

  useEffect(() => {
    let active = true;
    nextQuiz(roomId).then((r) => {
      if (!active || !r.ok) return;
      setRound(r);
      setAnswer(null);
    });
    return () => {
      active = false;
    };
  }, [roomId]);

  async function onAnswer(optionId: number) {
    if (!round || answer || busy) return;
    setBusy(true);
    const r = await answerQuiz({ roomId, roundId: round.roundId, optionId });
    setBusy(false);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    setAnswer({ chosen: optionId, correctId: r.correctId });
    if (r.correct) {
      setScore((s) => s + 1);
      onEarned(r.hourEarned);
      toast.success(
        r.coins > 0 ? `${copy.voetbal.quiz.correct} +${r.coins}` : copy.voetbal.quiz.correct,
      );
    } else {
      toast.error(copy.voetbal.quiz.wrong);
    }
  }

  if (!round) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end text-sm text-muted-foreground">
        {copy.voetbal.quiz.score(score)}
      </div>

      <p className="text-lg font-semibold">{round.question}</p>

      <div className="grid gap-2">
        {round.options.map((opt) => {
          const isCorrect = answer && opt.id === answer.correctId;
          const isWrongPick =
            answer && opt.id === answer.chosen && opt.id !== answer.correctId;
          return (
            <button
              key={opt.id}
              type="button"
              disabled={Boolean(answer) || busy}
              onClick={() => onAnswer(opt.id)}
              className={cn(
                "rounded-lg border p-3 text-left text-sm transition-colors",
                !answer && "hover:bg-muted",
                isCorrect && "border-emerald-500/50 bg-emerald-500/10",
                isWrongPick && "border-destructive/50 bg-destructive/10",
              )}
            >
              {opt.text}
            </button>
          );
        })}
      </div>

      {answer && (
        <Button className="w-full" disabled={busy} onClick={loadNext}>
          {copy.voetbal.quiz.next}
        </Button>
      )}
    </div>
  );
}
