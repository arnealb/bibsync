"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";

import { submitGameScore } from "@/app/_actions/games";
import { ShameModal, pickShameMsg } from "@/components/games/shame-modal";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import { isAutopilot, SNAKE_BOT_EVENT } from "@/lib/games/snake/autopilot";
import { botDirection } from "@/lib/games/snake/bot";
import {
  applyInput,
  createInitialState,
  GRID,
  nextSpeedMs,
  tick,
  type Direction,
  type SnakeState,
} from "@/lib/games/snake/engine";

const CELL_SIZE = 24;
const CANVAS_SIZE = CELL_SIZE * GRID;

interface SnakeGameProps {
  roomId: string;
  myBest: number | null;
}

function makeSeed(): number {
  return (Date.now() ^ Math.floor(Math.random() * 0xffffff)) | 0;
}

const KEY_MAP: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  a: "left",
  s: "down",
  d: "right",
  W: "up",
  A: "left",
  S: "down",
  D: "right",
};

const COARSE_POINTER_QUERY = "(pointer: coarse)";

function subscribeCoarse(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const mq = window.matchMedia(COARSE_POINTER_QUERY);
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

function getCoarseSnapshot(): boolean {
  return window.matchMedia(COARSE_POINTER_QUERY).matches;
}

function getCoarseServerSnapshot(): boolean {
  return false;
}

function useIsCoarsePointer(): boolean {
  return useSyncExternalStore(
    subscribeCoarse,
    getCoarseSnapshot,
    getCoarseServerSnapshot,
  );
}

function subscribeAutopilot(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(SNAKE_BOT_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(SNAKE_BOT_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function useAutopilot(): boolean {
  return useSyncExternalStore(subscribeAutopilot, isAutopilot, () => false);
}

export function SnakeGame({ roomId, myBest }: SnakeGameProps) {
  const isMobile = useIsCoarsePointer();
  const autopilot = useAutopilot();
  const [state, setState] = useState<SnakeState>(() =>
    createInitialState(makeSeed()),
  );
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const submittedRef = useRef(false);
  // True once the autopilot has driven at least one tick this game.
  const cheatedRef = useRef(false);
  const [shameMsg, setShameMsg] = useState<string | null>(null);

  // Keyboard input (desktop)
  useEffect(() => {
    if (autopilot) return;
    function onKey(e: KeyboardEvent) {
      const dir = KEY_MAP[e.key];
      if (!dir) return;
      e.preventDefault();
      setState((current) => applyInput(current, dir));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [autopilot]);

  // Swipe input (touch): a directional flick on the board turns the snake.
  useEffect(() => {
    if (autopilot) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const SWIPE_MIN = 20; // px — below this it's a tap, ignore
    let start: { x: number; y: number } | null = null;

    function onStart(e: TouchEvent) {
      const t = e.touches[0];
      start = { x: t.clientX, y: t.clientY };
    }
    function onEnd(e: TouchEvent) {
      if (!start) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      start = null;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      if (Math.max(absX, absY) < SWIPE_MIN) return;
      const dir: Direction =
        absX > absY ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
      setState((current) => applyInput(current, dir));
    }
    canvas.addEventListener("touchstart", onStart, { passive: true });
    canvas.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      canvas.removeEventListener("touchstart", onStart);
      canvas.removeEventListener("touchend", onEnd);
    };
  }, [autopilot]);

  // Tick loop — restarts when score changes (so speed steps up)
  useEffect(() => {
    if (state.gameOver) return;
    const interval = window.setInterval(() => {
      if (autopilot) cheatedRef.current = true;
      setState((current) =>
        autopilot
          ? tick({ ...current, inputQueue: [botDirection(current)] })
          : tick(current),
      );
    }, nextSpeedMs(state.score));
    return () => window.clearInterval(interval);
  }, [isMobile, autopilot, state.score, state.gameOver]);

  // Submit score once on game-over
  useEffect(() => {
    if (!state.gameOver || submittedRef.current || state.score === 0) return;
    submittedRef.current = true;
    const finalScore = state.score;
    const beatBest = finalScore > (myBest ?? 0);
    void submitGameScore({
      roomId,
      gameKey: "snake",
      score: finalScore,
      cheated: cheatedRef.current,
    }).then(
      (result) => {
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success(
          beatBest
            ? copy.games.snake.newHighScore
            : copy.games.snake.saved(finalScore),
        );
        if (!beatBest) setShameMsg(pickShameMsg());
      },
    );
  }, [state.gameOver, state.score, roomId, myBest]);

  // Render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 1;
    for (let i = 1; i < GRID; i++) {
      ctx.beginPath();
      ctx.moveTo(i * CELL_SIZE + 0.5, 0);
      ctx.lineTo(i * CELL_SIZE + 0.5, CANVAS_SIZE);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * CELL_SIZE + 0.5);
      ctx.lineTo(CANVAS_SIZE, i * CELL_SIZE + 0.5);
      ctx.stroke();
    }

    ctx.fillStyle = "#ef4444";
    ctx.fillRect(
      state.food.x * CELL_SIZE + 3,
      state.food.y * CELL_SIZE + 3,
      CELL_SIZE - 6,
      CELL_SIZE - 6,
    );

    ctx.fillStyle = "#22c55e";
    for (const cell of state.snake) {
      ctx.fillRect(
        cell.x * CELL_SIZE + 1,
        cell.y * CELL_SIZE + 1,
        CELL_SIZE - 2,
        CELL_SIZE - 2,
      );
    }
  }, [state]);

  const restart = useCallback(() => {
    submittedRef.current = false;
    cheatedRef.current = false;
    setState(createInitialState(makeSeed()));
  }, []);

  // Cash out: end the run now so the current (autopilot) score gets submitted,
  // instead of waiting for the bot to fill the whole board.
  const cashOut = useCallback(() => {
    setState((current) =>
      current.gameOver ? current : { ...current, gameOver: true },
    );
  }, []);

  return (
    <div className="space-y-3">
      {shameMsg && (
        <ShameModal message={shameMsg} onDone={() => setShameMsg(null)} />
      )}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm">
          <span className="text-muted-foreground">
            {copy.games.snake.score}:
          </span>{" "}
          <span className="font-mono tabular-nums font-semibold">
            {state.score}
          </span>
        </p>
        <div className="flex items-center gap-2">
          {autopilot && !state.gameOver && state.score > 0 && (
            <Button size="sm" onClick={cashOut}>
              {copy.games.snake.saveResult}
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={restart}>
            {copy.games.snake.restart}
          </Button>
        </div>
      </div>
      <canvas
        ref={canvasRef}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        style={{ maxWidth: CANVAS_SIZE }}
        className="h-auto w-full touch-none rounded-lg border select-none"
        tabIndex={0}
        aria-label={copy.games.snake.title}
      />
      {isMobile && !state.gameOver && (
        <p className="text-center text-xs text-muted-foreground">
          {copy.games.snake.swipeHint}
        </p>
      )}
      {state.gameOver && (
        <p className="text-sm font-medium text-destructive">
          {copy.games.snake.gameOver}
        </p>
      )}
    </div>
  );
}
