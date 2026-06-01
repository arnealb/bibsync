"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { submitGameScore } from "@/app/_actions/games";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";

const W = 320;
const H = 460;
const GROUND = H - 36;
const BIRD_X = 84;
const BIRD_R = 13;
const GRAVITY = 0.34;
const FLAP = -6.4;
const MAX_FALL = 8; // terminal velocity so the drop never feels brutal
const PIPE_W = 54;
const GAP = 126;
const SPEED = 2.6;
const SPAWN_GAP = 180; // horizontal distance between pipes

interface Pipe {
  x: number;
  gapTop: number;
  passed: boolean;
}

type Phase = "idle" | "playing" | "over";

interface Game {
  phase: Phase;
  y: number;
  vy: number;
  pipes: Pipe[];
  score: number;
}

function freshGame(): Game {
  return { phase: "idle", y: H / 2, vy: 0, pipes: [], score: 0 };
}

export function FlappyGame({
  roomId,
  myBest,
}: {
  roomId: string;
  myBest: number | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const game = useRef<Game>(freshGame());
  const submitted = useRef(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(myBest ?? 0);

  function flap() {
    const g = game.current;
    if (g.phase === "over") return;
    if (g.phase === "idle") {
      g.phase = "playing";
      setPhase("playing");
    }
    g.vy = FLAP;
  }

  function restart() {
    submitted.current = false;
    game.current = freshGame();
    setScore(0);
    setPhase("idle");
  }

  // Submit + record once on game over.
  function endGame() {
    const g = game.current;
    g.phase = "over";
    setPhase("over");
    if (submitted.current) return;
    submitted.current = true;
    const final = g.score;
    void submitGameScore({ roomId, gameKey: "flappy", score: final }).then(
      (res) => {
        if (!res.ok) return;
        toast.success(copy.games.flappy.saved(final));
        if (final > best) {
          setBest(final);
          if (final > 0) toast.success(copy.games.flappy.newBest);
        }
      },
    );
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const maybeCtx = canvas.getContext("2d");
    if (!maybeCtx) return;
    const ctx: CanvasRenderingContext2D = maybeCtx;

    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const STEP = 1000 / 60; // fixed 60 physics ticks/sec, any refresh rate

    // One physics tick (tuned for 60 ticks/sec).
    function tick() {
      const g = game.current;
      if (g.phase !== "playing") return;
      g.vy = Math.min(g.vy + GRAVITY, MAX_FALL);
      g.y += g.vy;

      const lastPipe = g.pipes[g.pipes.length - 1];
      if (!lastPipe || lastPipe.x < W - SPAWN_GAP) {
        const gapTop = 50 + Math.floor(Math.random() * (GROUND - GAP - 100));
        g.pipes.push({ x: W, gapTop, passed: false });
      }
      for (const p of g.pipes) p.x -= SPEED;
      g.pipes = g.pipes.filter((p) => p.x + PIPE_W > -10);

      for (const p of g.pipes) {
        if (!p.passed && p.x + PIPE_W < BIRD_X) {
          p.passed = true;
          g.score += 1;
          setScore(g.score);
        }
        const hitX = BIRD_X + BIRD_R > p.x && BIRD_X - BIRD_R < p.x + PIPE_W;
        const hitGap = g.y - BIRD_R > p.gapTop && g.y + BIRD_R < p.gapTop + GAP;
        if (hitX && !hitGap) endGame();
      }
      if (g.y + BIRD_R >= GROUND || g.y - BIRD_R <= 0) endGame();
    }

    function frame(now: number) {
      acc += now - last;
      last = now;
      if (acc > 250) acc = 250; // don't spiral after a tab pause
      while (acc >= STEP) {
        tick();
        acc -= STEP;
      }
      draw(ctx, game.current);
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    function onKey(e: KeyboardEvent) {
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        flap();
      }
    }
    window.addEventListener("keydown", onKey);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-mono tabular-nums">
          {copy.games.flappy.score}: <b>{score}</b>
        </span>
        <span className="font-mono tabular-nums text-muted-foreground">
          {copy.games.flappy.best}: {best}
        </span>
      </div>
      <div
        className="relative mx-auto w-full max-w-[320px] cursor-pointer select-none"
        onPointerDown={(e) => {
          e.preventDefault();
          flap();
        }}
      >
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className="w-full rounded-xl border"
        />
        {phase !== "playing" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-xl bg-black/40 text-center text-white">
            {phase === "over" ? (
              <>
                <p className="text-lg font-bold">{copy.games.flappy.gameOver}</p>
                <p className="font-mono">
                  {copy.games.flappy.score}: {score}
                </p>
                <Button onClick={restart}>{copy.games.flappy.restart}</Button>
              </>
            ) : (
              <p className="px-4 text-sm font-medium">
                {copy.games.flappy.tapToStart}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function draw(ctx: CanvasRenderingContext2D, g: Game) {
  // Sky
  ctx.fillStyle = "#7ec0ee";
  ctx.fillRect(0, 0, W, H);

  // Pipes
  ctx.fillStyle = "#22a34a";
  for (const p of g.pipes) {
    ctx.fillRect(p.x, 0, PIPE_W, p.gapTop);
    ctx.fillRect(p.x, p.gapTop + GAP, PIPE_W, GROUND - (p.gapTop + GAP));
  }

  // Ground
  ctx.fillStyle = "#c2a14d";
  ctx.fillRect(0, GROUND, W, H - GROUND);

  // Bird
  ctx.beginPath();
  ctx.arc(BIRD_X, g.y, BIRD_R, 0, Math.PI * 2);
  ctx.fillStyle = "#f59e0b";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#92400e";
  ctx.stroke();
  // Eye + beak
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(BIRD_X + 4, g.y - 4, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#dc2626";
  ctx.fillRect(BIRD_X + BIRD_R - 2, g.y - 2, 6, 4);
}
