"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { submitGameScore } from "@/app/_actions/games";
import { LedDisplay } from "@/components/games/minesweeper/led-display";
import { MinesweeperBoard } from "@/components/games/minesweeper/minesweeper-board";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import {
  MINESWEEPER_DIFFICULTIES,
  createGame,
  revealCell,
  toggleFlag,
  type MinesweeperDifficulty,
  type MinesweeperState,
} from "@/lib/games/minesweeper/engine";
import { MINESWEEPER_GAME_KEYS } from "@/lib/games/minesweeper/keys";
import { mmss } from "@/lib/games/rank";
import { cn } from "@/lib/utils";

const DIFFICULTY_KEYS = Object.keys(
  MINESWEEPER_DIFFICULTIES,
) as MinesweeperDifficulty[];

function makeSeed(): number {
  return (Date.now() ^ Math.floor(Math.random() * 0xffffff)) | 0;
}

interface MinesweeperGameProps {
  roomId: string;
  /** The player's fastest winning time per difficulty (seconds), if any. */
  myBestTimes: Record<MinesweeperDifficulty, number | null>;
}

export function MinesweeperGame({ roomId, myBestTimes }: MinesweeperGameProps) {
  const [state, setState] = useState<MinesweeperState>(() =>
    createGame("easy", makeSeed()),
  );
  const [seconds, setSeconds] = useState(0);
  const [flagMode, setFlagMode] = useState(false);
  const submittedRef = useRef(false);

  const ended = state.status === "won" || state.status === "lost";

  useEffect(() => {
    if (state.status !== "playing") return;
    const id = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [state.status]);

  useEffect(() => {
    if (!ended || submittedRef.current || state.revealed === 0) return;
    submittedRef.current = true;
    const gameKey = MINESWEEPER_GAME_KEYS[state.difficulty];

    if (state.status === "lost") {
      // Revealed cells still pay coins, but only a completed board ranks.
      void submitGameScore({
        roomId,
        gameKey,
        score: state.revealed,
        coinsOnly: true,
      }).then((r) => {
        if (!r.ok) toast.error(r.error);
      });
      return;
    }

    const time = Math.min(seconds, 86_400);
    const best = myBestTimes[state.difficulty];
    void submitGameScore({
      roomId,
      gameKey,
      score: state.revealed,
      durationSeconds: time,
    }).then((r) => {
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(
        best === null || time < best
          ? copy.games.minesweeper.newBestTime
          : copy.games.minesweeper.savedTime(mmss(time)),
      );
    });
  }, [
    ended,
    state.status,
    state.difficulty,
    state.revealed,
    seconds,
    roomId,
    myBestTimes,
  ]);

  const restart = useCallback((difficulty: MinesweeperDifficulty) => {
    submittedRef.current = false;
    setSeconds(0);
    setState(createGame(difficulty, makeSeed()));
  }, []);

  const onReveal = useCallback(
    (r: number, c: number) => {
      setState((s) => (flagMode ? toggleFlag(s, r, c) : revealCell(s, r, c)));
    },
    [flagMode],
  );

  const onFlag = useCallback((r: number, c: number) => {
    setState((s) => toggleFlag(s, r, c));
  }, []);

  const face =
    state.status === "won" ? "😎" : state.status === "lost" ? "😵" : "🙂";
  const bestTime = myBestTimes[state.difficulty];

  return (
    <div className="w-full max-w-105 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {DIFFICULTY_KEYS.map((key) => (
          <Button
            key={key}
            size="sm"
            variant={state.difficulty === key ? "default" : "outline"}
            onClick={() => restart(key)}
          >
            {copy.games.minesweeper.difficulty[key]}
          </Button>
        ))}
        <Button
          size="sm"
          variant={flagMode ? "default" : "outline"}
          aria-pressed={flagMode}
          onClick={() => setFlagMode((f) => !f)}
        >
          🚩 {copy.games.minesweeper.flagMode}
        </Button>
      </div>

      <div className="rounded-md border-2 border-t-[#79839a] border-l-[#79839a] border-b-[#232831] border-r-[#232831] bg-[#3d4453] p-2 shadow-md sm:p-3">
        <div className="mb-2 flex items-center justify-between rounded-sm border-2 border-t-[#1f242d] border-l-[#1f242d] border-b-[#5d6675] border-r-[#5d6675] bg-[#353c49] px-2 py-1.5 sm:mb-3">
          <LedDisplay
            value={state.mines - state.flags}
            label={copy.games.minesweeper.minesLeft}
          />
          <button
            type="button"
            onClick={() => restart(state.difficulty)}
            aria-label={copy.games.minesweeper.restart}
            className={cn(
              "flex size-10 items-center justify-center rounded-sm border-2 border-t-[#79839a] border-l-[#79839a] border-b-[#232831] border-r-[#232831] bg-[#4d5564] text-xl",
              "active:border-t-[#232831] active:border-l-[#232831] active:border-b-[#79839a] active:border-r-[#79839a]",
            )}
          >
            {face}
          </button>
          <LedDisplay
            value={Math.min(999, seconds)}
            label={copy.games.minesweeper.timer}
          />
        </div>
        <MinesweeperBoard state={state} onReveal={onReveal} onFlag={onFlag} />
      </div>

      <p className="text-sm text-muted-foreground">
        {copy.games.minesweeper.controls}
      </p>
      {bestTime !== null && (
        <p className="text-sm text-muted-foreground">
          {copy.games.minesweeper.yourBestTime(mmss(bestTime))}
        </p>
      )}
      {state.status === "won" && (
        <p className="text-sm font-medium text-emerald-500">
          {copy.games.minesweeper.won(seconds)}
        </p>
      )}
      {state.status === "lost" && (
        <p className="text-sm font-medium text-destructive">
          {copy.games.minesweeper.lost}
        </p>
      )}
    </div>
  );
}
