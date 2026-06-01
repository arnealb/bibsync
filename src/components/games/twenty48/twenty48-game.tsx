"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { submitGameScore } from "@/app/_actions/games";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import {
  createInitialState,
  move,
  type Direction,
  type Game2048State,
} from "@/lib/games/twenty48/engine";

const TILE_COLOURS: Record<number, string> = {
  0: "bg-muted",
  2: "bg-amber-100 text-amber-950",
  4: "bg-amber-200 text-amber-950",
  8: "bg-orange-300 text-orange-950",
  16: "bg-orange-400 text-white",
  32: "bg-orange-500 text-white",
  64: "bg-red-500 text-white",
  128: "bg-yellow-400 text-yellow-950",
  256: "bg-yellow-500 text-white",
  512: "bg-green-500 text-white",
  1024: "bg-blue-500 text-white",
  2048: "bg-purple-600 text-white",
};

function makeSeed(): number {
  return (Date.now() ^ Math.floor(Math.random() * 0xffffff)) | 0;
}

const KEY_DIR: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

const SWIPE_MIN = 24;

interface Game2048Props {
  roomId: string;
  myBest: number | null;
}

export function Game2048({ roomId, myBest }: Game2048Props) {
  const [state, setState] = useState<Game2048State>(() =>
    createInitialState(makeSeed()),
  );
  const submittedRef = useRef(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const doMove = useCallback((dir: Direction) => {
    setState((s) => move(s, dir));
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const dir = KEY_DIR[e.key];
      if (!dir) return;
      e.preventDefault();
      doMove(dir);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [doMove]);

  useEffect(() => {
    if (!state.gameOver || submittedRef.current) return;
    submittedRef.current = true;
    const score = state.highestTile;
    const beatBest = score > (myBest ?? 0);
    void submitGameScore({ roomId, gameKey: "2048", score }).then((r) => {
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(
        beatBest ? copy.games.twenty48.newHighScore : copy.games.twenty48.saved(score),
      );
    });
  }, [state.gameOver, state.highestTile, roomId, myBest]);

  const restart = useCallback(() => {
    submittedRef.current = false;
    setState(createInitialState(makeSeed()));
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm">
          <span className="text-muted-foreground">
            {copy.games.twenty48.score}:
          </span>{" "}
          <span className="font-mono tabular-nums font-semibold">
            {state.highestTile}
          </span>
        </p>
        <Button size="sm" variant="outline" onClick={restart}>
          {copy.games.twenty48.restart}
        </Button>
      </div>
      <div
        className="grid w-[280px] touch-none grid-cols-4 gap-2 rounded-lg border bg-card p-2"
        onPointerDown={(e) => {
          touchStart.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={(e) => {
          const start = touchStart.current;
          touchStart.current = null;
          if (!start) return;
          const dx = e.clientX - start.x;
          const dy = e.clientY - start.y;
          if (Math.abs(dx) < SWIPE_MIN && Math.abs(dy) < SWIPE_MIN) return;
          if (Math.abs(dx) > Math.abs(dy)) doMove(dx > 0 ? "right" : "left");
          else doMove(dy > 0 ? "down" : "up");
        }}
      >
        {state.grid.flat().map((value, i) => (
          <div
            key={i}
            className={`flex aspect-square items-center justify-center rounded-md text-lg font-bold tabular-nums ${
              TILE_COLOURS[value] ?? "bg-purple-700 text-white"
            }`}
          >
            {value !== 0 ? value : ""}
          </div>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">{copy.games.twenty48.controls}</p>
      {state.gameOver && (
        <p className="text-sm font-medium text-destructive">
          {copy.games.twenty48.gameOver}
        </p>
      )}
    </div>
  );
}
