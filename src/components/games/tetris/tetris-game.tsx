"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { submitGameScore } from "@/app/_actions/games";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import {
  COLS,
  PIECE_ID,
  ROWS,
  cellsOf,
  createInitialState,
  hardDrop,
  moveLeft,
  moveRight,
  rotate,
  softDrop,
  tick,
  type TetrisState,
} from "@/lib/games/tetris/engine";

const CELL = 22;
const WIDTH = COLS * CELL;
const HEIGHT = ROWS * CELL;
const TICK_MS = 500;

const COLOURS: Record<number, string> = {
  1: "#22d3ee", 2: "#facc15", 3: "#a855f7", 4: "#22c55e",
  5: "#ef4444", 6: "#3b82f6", 7: "#f97316",
};

function makeSeed(): number {
  return (Date.now() ^ Math.floor(Math.random() * 0xffffff)) | 0;
}

interface TetrisGameProps {
  roomId: string;
  myBest: number | null;
}

export function TetrisGame({ roomId, myBest }: TetrisGameProps) {
  const [state, setState] = useState<TetrisState>(() =>
    createInitialState(makeSeed()),
  );
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const submittedRef = useRef(false);

  useEffect(() => {
    if (state.gameOver) return;
    const id = window.setInterval(() => setState((s) => tick(s)), TICK_MS);
    return () => window.clearInterval(id);
  }, [state.gameOver]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const map: Record<string, (s: TetrisState) => TetrisState> = {
        ArrowLeft: moveLeft,
        ArrowRight: moveRight,
        ArrowUp: rotate,
        ArrowDown: softDrop,
        " ": hardDrop,
      };
      const fn = map[e.key];
      if (!fn) return;
      e.preventDefault();
      setState((s) => fn(s));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!state.gameOver || submittedRef.current || state.lines === 0) return;
    submittedRef.current = true;
    const score = state.lines;
    const beatBest = score > (myBest ?? 0);
    void submitGameScore({ roomId, gameKey: "tetris", score }).then((r) => {
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(
        beatBest ? copy.games.tetris.newHighScore : copy.games.tetris.saved(score),
      );
    });
  }, [state.gameOver, state.lines, roomId, myBest]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    const paint = (x: number, y: number, colour: string) => {
      ctx.fillStyle = colour;
      ctx.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2);
    };

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const id = state.board[y][x];
        if (id !== 0) paint(x, y, COLOURS[id] ?? "#999");
      }
    }
    const activeColour = COLOURS[PIECE_ID[state.active.type]] ?? "#999";
    for (const [x, y] of cellsOf(state.active)) {
      if (y >= 0) paint(x, y, activeColour);
    }
  }, [state]);

  const restart = useCallback(() => {
    submittedRef.current = false;
    setState(createInitialState(makeSeed()));
  }, []);

  const press = (fn: (s: TetrisState) => TetrisState) => () =>
    setState((s) => fn(s));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm">
          <span className="text-muted-foreground">
            {copy.games.tetris.score}:
          </span>{" "}
          <span className="font-mono tabular-nums font-semibold">
            {state.lines}
          </span>
        </p>
        <Button size="sm" variant="outline" onClick={restart}>
          {copy.games.tetris.restart}
        </Button>
      </div>
      <canvas
        ref={canvasRef}
        width={WIDTH}
        height={HEIGHT}
        className="rounded-lg border"
        aria-label={copy.games.tetris.title}
      />
      <div className="flex flex-wrap gap-2 sm:hidden">
        <Button size="sm" variant="outline" onClick={press(moveLeft)}>
          {copy.games.tetris.left}
        </Button>
        <Button size="sm" variant="outline" onClick={press(rotate)}>
          {copy.games.tetris.rotate}
        </Button>
        <Button size="sm" variant="outline" onClick={press(moveRight)}>
          {copy.games.tetris.right}
        </Button>
        <Button size="sm" variant="outline" onClick={press(hardDrop)}>
          {copy.games.tetris.drop}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">{copy.games.tetris.controls}</p>
      {state.gameOver && (
        <p className="text-sm font-medium text-destructive">
          {copy.games.tetris.gameOver}
        </p>
      )}
    </div>
  );
}
