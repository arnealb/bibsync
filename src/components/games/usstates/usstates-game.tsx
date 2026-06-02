"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { submitGameScore } from "@/app/_actions/games";
import { claimStateCoin } from "@/app/_actions/usstates";
import { UsStatesMap } from "@/components/games/usstates/usstates-map";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { copy } from "@/lib/copy";
import { matchState } from "@/lib/usstates/match";
import {
  USSTATES_DURATION_SECONDS,
  USSTATES_TOTAL,
} from "@/lib/usstates/config";
import { US_STATES } from "@/lib/usstates/states";

type Status = "idle" | "running" | "ended";

function mmss(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function UsStatesGame({
  roomId,
  initialBalance,
  myBest,
}: {
  roomId: string;
  initialBalance: number;
  myBest: number | null;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [found, setFound] = useState<ReadonlySet<string>>(new Set());
  const [value, setValue] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(USSTATES_DURATION_SECONDS);
  const [balance, setBalance] = useState(initialBalance);
  const inputRef = useRef<HTMLInputElement>(null);
  const endedRef = useRef(false);

  // End the round exactly once, then persist the score.
  const endGame = useCallback(
    (score: number) => {
      if (endedRef.current) return;
      endedRef.current = true;
      setStatus("ended");
      void (async () => {
        const res = await submitGameScore({
          roomId,
          gameKey: "usstates",
          score,
        });
        if (!res.ok) toast.error(res.error);
        else if (myBest === null || score > myBest) {
          toast.success(copy.usstates.newBest(score));
        }
      })();
    },
    [roomId, myBest],
  );

  // Countdown.
  useEffect(() => {
    if (status !== "running") return;
    const id = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(id);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [status]);

  // React to time running out (kept out of the interval to avoid stale closures).
  useEffect(() => {
    if (status === "running" && secondsLeft === 0) endGame(found.size);
  }, [status, secondsLeft, found.size, endGame]);

  function startGame() {
    endedRef.current = false;
    setFound(new Set());
    setValue("");
    setSecondsLeft(USSTATES_DURATION_SECONDS);
    setStatus("running");
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function onChange(next: string) {
    setValue(next);
    if (status !== "running") return;
    const code = matchState(next, found);
    if (!code) return;
    // Correct, fresh state: accept it, clear the box, award the coin.
    const nextFound = new Set(found);
    nextFound.add(code);
    setFound(nextFound);
    setValue("");
    void claimStateCoin({ roomId, code }).then((res) => {
      if (res.ok) {
        setBalance(res.balance);
        if (res.awarded) toast.success(copy.usstates.coinAwarded);
      }
    });
    if (nextFound.size === USSTATES_TOTAL) endGame(USSTATES_TOTAL);
  }

  const missed = US_STATES.filter((s) => !found.has(s.code));

  return (
    <div className="space-y-4">
      {/* Status bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="font-mono tabular-nums">
          {copy.usstates.found(found.size, USSTATES_TOTAL)}
        </span>
        <span className="font-mono tabular-nums text-muted-foreground">
          {copy.usstates.timeLeft(mmss(secondsLeft))}
        </span>
        <span className="font-mono tabular-nums text-amber-500">
          {copy.usstates.balance(balance)}
        </span>
      </div>

      {/* Input / start */}
      {status === "running" ? (
        <div className="flex items-center gap-2">
          <Input
            ref={inputRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={copy.usstates.placeholder}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            aria-label={copy.usstates.placeholder}
          />
          <Button variant="outline" onClick={() => endGame(found.size)}>
            {copy.usstates.giveUp}
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {copy.usstates.instructions}
          </p>
          <p className="text-xs text-amber-500">{copy.usstates.coinHint}</p>
          <Button onClick={startGame}>
            {status === "ended" ? copy.usstates.playAgain : copy.usstates.start}
          </Button>
        </div>
      )}

      {/* Map */}
      <div className="rounded-xl border bg-muted/10 p-2">
        <UsStatesMap found={found} revealed={status === "ended"} />
      </div>

      {/* End summary */}
      {status === "ended" && (
        <div className="space-y-2 rounded-xl border p-4">
          <p className="font-medium">
            {found.size === USSTATES_TOTAL
              ? copy.usstates.finishedAll
              : secondsLeft === 0
                ? copy.usstates.finishedTime
                : copy.usstates.finishedGaveUp}
          </p>
          <p className="text-sm text-muted-foreground">
            {copy.usstates.resultLine(found.size, USSTATES_TOTAL)}
          </p>
          {missed.length > 0 && (
            <p className="text-sm">
              <span className="font-medium">{copy.usstates.missedHeading}:</span>{" "}
              <span className="text-muted-foreground">
                {missed.map((s) => s.name).join(", ")}
              </span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
