"use client";

import { useCallback, useEffect, useState } from "react";
import { Coins, Trophy } from "lucide-react";
import { toast } from "sonner";

import {
  guessVoetbal,
  revealVoetbal,
  startVoetbalRound,
  type StartRoundResult,
  type VoetbalSlot,
} from "@/app/_actions/voetbal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VoetbalCapBar } from "@/components/voetbal/voetbal-cap-bar";
import { copy } from "@/lib/copy";
import {
  VOETBAL_COINS_PER_CORRECT,
  VOETBAL_ROUND_SECONDS,
} from "@/lib/voetbal/config";
import { VOETBAL_CATEGORIES } from "@/lib/voetbal/categories";
import { cn } from "@/lib/utils";

type Round = Extract<StartRoundResult, { ok: true }>;

export function VoetbalGame({ roomId }: { roomId: string }) {
  const [categoryKey, setCategoryKey] = useState(VOETBAL_CATEGORIES[0].key);
  const [round, setRound] = useState<Round | null>(null);
  const [phase, setPhase] = useState<"idle" | "playing" | "done">("idle");
  const [found, setFound] = useState<Record<number, string>>({});
  const [reveal, setReveal] = useState<Record<number, string>>({});
  const [timeLeft, setTimeLeft] = useState(VOETBAL_ROUND_SECONDS);
  const [roundCoins, setRoundCoins] = useState(0);
  const [hourEarned, setHourEarned] = useState(0);
  const [guess, setGuess] = useState("");
  const [starting, setStarting] = useState(false);

  const foundCount = Object.keys(found).length;
  const won = round != null && foundCount >= round.winAt;

  const endRound = useCallback((cat: string) => {
    setPhase("done");
    void revealVoetbal(cat).then((r) => {
      if (r.ok) setReveal(Object.fromEntries(r.names.map((n) => [n.id, n.name])));
    });
  }, []);

  // Countdown + a fixed end-of-round timer (callbacks, not render-phase state).
  useEffect(() => {
    if (phase !== "playing" || !round) return;
    const cat = round.categoryKey;
    const tick = window.setInterval(
      () => setTimeLeft((t) => Math.max(0, t - 1)),
      1000,
    );
    const end = window.setTimeout(
      () => endRound(cat),
      VOETBAL_ROUND_SECONDS * 1000,
    );
    return () => {
      window.clearInterval(tick);
      window.clearTimeout(end);
    };
  }, [phase, round, endRound]);

  async function onStart() {
    setStarting(true);
    const result = await startVoetbalRound({ roomId, categoryKey });
    setStarting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setRound(result);
    setFound({});
    setReveal({});
    setRoundCoins(0);
    setHourEarned(result.hourEarned);
    setTimeLeft(VOETBAL_ROUND_SECONDS);
    setGuess("");
    setPhase("playing");
  }

  async function onGuess(e: React.FormEvent) {
    e.preventDefault();
    const text = guess.trim();
    if (!round || phase !== "playing" || !text) return;
    setGuess("");

    const result = await guessVoetbal({
      roomId,
      roundId: round.roundId,
      categoryKey: round.categoryKey,
      guess: text,
    });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    if (!result.correct || result.id == null) {
      toast.error(copy.voetbal.wrong);
      return;
    }
    if (found[result.id]) {
      toast.info(copy.voetbal.already);
      return;
    }
    setFound((f) => ({ ...f, [result.id!]: result.name! }));
    setRoundCoins((c) => c + result.coins);
    setHourEarned(result.hourEarned);
    if (result.coins > 0) {
      toast.success(`${result.name} · ${copy.voetbal.coinsGained(result.coins)}`);
    } else {
      toast.success(`${result.name} · ${copy.voetbal.capped}`);
    }
    // Naming the whole list ends the round early (a guaranteed win).
    if (foundCount + 1 >= round.total) endRound(round.categoryKey);
  }

  return (
    <div className="space-y-5">
      <VoetbalCapBar earned={hourEarned} />

      {phase === "idle" ? (
        <div className="space-y-4">
          <p className="text-sm font-medium">{copy.voetbal.chooseList}</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {VOETBAL_CATEGORIES.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setCategoryKey(c.key)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl border p-4 transition-colors",
                  categoryKey === c.key
                    ? "border-primary bg-primary/5"
                    : "hover:bg-muted",
                )}
              >
                <span className="text-2xl">{c.emoji}</span>
                <span className="text-sm font-medium">{c.label}</span>
                <span className="text-xs text-muted-foreground">
                  {c.total} spelers
                </span>
              </button>
            ))}
          </div>
          <Button onClick={onStart} disabled={starting} className="w-full">
            {copy.voetbal.start}
          </Button>
        </div>
      ) : (
        round && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">
                  {round.emoji} {round.label}
                </p>
                <p className="text-xs text-muted-foreground">
                  {copy.voetbal.progress(foundCount, round.total)} ·{" "}
                  {copy.voetbal.needed(round.winAt)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1 text-sm font-medium tabular-nums">
                  <Coins className="size-4 text-amber-500" />
                  {roundCoins}
                </span>
                {phase === "playing" && (
                  <span
                    className={cn(
                      "rounded-md px-2 py-1 font-mono text-sm tabular-nums",
                      timeLeft <= 15
                        ? "bg-destructive/15 text-destructive"
                        : "bg-muted",
                    )}
                  >
                    {copy.voetbal.timeLeft(timeLeft)}
                  </span>
                )}
              </div>
            </div>

            {phase === "playing" && (
              <form onSubmit={onGuess} className="flex gap-2">
                <Input
                  autoFocus
                  value={guess}
                  onChange={(e) => setGuess(e.target.value)}
                  placeholder={copy.voetbal.placeholder}
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                />
                <Button type="submit">{copy.voetbal.submit}</Button>
              </form>
            )}

            {phase === "done" && (
              <div
                className={cn(
                  "rounded-xl border p-4 text-center",
                  won
                    ? "border-emerald-500/40 bg-emerald-500/10"
                    : "border-border bg-muted/40",
                )}
              >
                <p className="flex items-center justify-center gap-2 text-lg font-semibold">
                  {won && <Trophy className="size-5 text-amber-500" />}
                  {won ? copy.voetbal.win : copy.voetbal.lose}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {won
                    ? copy.voetbal.winSub(roundCoins)
                    : copy.voetbal.loseSub(foundCount, round.winAt)}
                </p>
                <Button onClick={onStart} disabled={starting} className="mt-3">
                  {copy.voetbal.restart}
                </Button>
              </div>
            )}

            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {round.slots.map((slot) => (
                <SlotCard
                  key={slot.id}
                  slot={slot}
                  name={found[slot.id]}
                  revealedName={phase === "done" ? reveal[slot.id] : undefined}
                />
              ))}
            </ul>
          </div>
        )
      )}

      <p className="text-center text-xs text-muted-foreground">
        {copy.voetbal.reward(VOETBAL_COINS_PER_CORRECT)}
      </p>
    </div>
  );
}

function SlotCard({
  slot,
  name,
  revealedName,
}: {
  slot: VoetbalSlot;
  name?: string;
  revealedName?: string;
}) {
  const guessed = Boolean(name);
  const shown = name ?? revealedName;
  return (
    <li
      className={cn(
        "flex items-center gap-2 rounded-lg border p-2.5 text-sm transition-colors",
        guessed
          ? "border-emerald-500/40 bg-emerald-500/10"
          : revealedName
            ? "border-border bg-muted/30 opacity-70"
            : "bg-card",
      )}
    >
      <span className="text-lg" aria-hidden>
        {slot.flag}
      </span>
      <div className="min-w-0">
        {shown ? (
          <p className="truncate font-medium">{shown}</p>
        ) : (
          <p className="font-mono font-medium tracking-wider">{slot.initials}</p>
        )}
        <p className="truncate text-xs text-muted-foreground">{slot.position}</p>
      </div>
    </li>
  );
}
