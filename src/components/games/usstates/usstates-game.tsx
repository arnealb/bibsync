"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { submitGameScore } from "@/app/_actions/games";
import { claimStateCoin } from "@/app/_actions/usstates";
import { ShameModal, pickShameMsg } from "@/components/games/shame-modal";
import { UsStatesMap } from "@/components/games/usstates/usstates-map";
import { UsStatesSummary } from "@/components/games/usstates/usstates-summary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { copy } from "@/lib/copy";
import { mmss } from "@/lib/games/rank";
import { matchState } from "@/lib/usstates/match";
import {
  USSTATES_DURATION_SECONDS,
  USSTATES_TOTAL,
} from "@/lib/usstates/config";

type Status = "idle" | "running" | "ended";

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
  const [shameMsg, setShameMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const endedRef = useRef(false);
  // Elapsed seconds at the last correct guess — the leaderboard tie-breaker.
  const lastFoundElapsedRef = useRef(0);

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
          durationSeconds: lastFoundElapsedRef.current,
        });
        if (!res.ok) toast.error(res.error);
        else if (myBest === null || score > myBest) {
          toast.success(copy.usstates.newBest(score));
        } else if (score > 0) {
          setShameMsg(pickShameMsg());
        }
      })();
    },
    [roomId, myBest],
  );

  // Countdown.
  useEffect(() => {
    if (status !== "running") return;
    const id = setInterval(() => {
      setSecondsLeft((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [status]);

  // React to time running out (kept out of the interval to avoid stale closures).
  useEffect(() => {
    if (status === "running" && secondsLeft === 0) endGame(found.size);
  }, [status, secondsLeft, found.size, endGame]);

  function startGame() {
    endedRef.current = false;
    lastFoundElapsedRef.current = 0;
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
    lastFoundElapsedRef.current = USSTATES_DURATION_SECONDS - secondsLeft;
    const nextFound = new Set(found);
    nextFound.add(code);
    setFound(nextFound);
    setValue("");
    void claimStateCoin({ roomId, code }).then((res) => {
      if (res.ok) {
        setBalance(res.balance);
        if (res.awarded) toast.success(copy.usstates.coinAwarded);
      } else {
        toast.error(res.error);
      }
    });
    if (nextFound.size === USSTATES_TOTAL) endGame(USSTATES_TOTAL);
  }

  return (
    <div className="space-y-4">
      {shameMsg && (
        <ShameModal message={shameMsg} onDone={() => setShameMsg(null)} />
      )}
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
        <UsStatesSummary found={found} secondsLeft={secondsLeft} />
      )}
    </div>
  );
}
