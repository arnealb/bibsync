"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { submitGameScore } from "@/app/_actions/games";
import { ShameModal, pickShameMsg } from "@/components/games/shame-modal";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";

const W = 600;
const H = 200;
const GROUND = 178; // y of the ground line (dino feet)
const DINO_X = 46;
const STAND_W = 22;
const STAND_H = 36;
const DUCK_W = 32;
const DUCK_H = 20;
const GRAVITY = 0.55;
const FAST_FALL = 1.4; // extra gravity while holding duck mid-air
const JUMP_V = -10.4;
const START_SPEED = 5;
const MAX_SPEED = 11;
const SPEED_RAMP = 0.0012; // per physics tick
const BIRD_MIN_SCORE = 6; // birds only show up once the run is going
const FG = "#535353"; // the classic Chrome dino gray
const BG = "#f7f7f7";

type ObstacleKind = "cactus" | "bird";

interface Obstacle {
  kind: ObstacleKind;
  x: number;
  y: number; // top
  w: number;
  h: number;
  passed: boolean;
}

interface Cloud {
  x: number;
  y: number;
}

type Phase = "idle" | "playing" | "over";

interface Game {
  phase: Phase;
  y: number; // dino top while standing (feet on GROUND)
  vy: number;
  ducking: boolean;
  airborne: boolean;
  speed: number;
  ticks: number;
  scoreTicks: number; // ticks at the last passed obstacle (for duration)
  obstacles: Obstacle[];
  clouds: Cloud[];
  score: number;
}

function freshGame(): Game {
  return {
    phase: "idle",
    y: GROUND - STAND_H,
    vy: 0,
    ducking: false,
    airborne: false,
    speed: START_SPEED,
    ticks: 0,
    scoreTicks: 0,
    obstacles: [],
    clouds: [
      { x: 120, y: 38 },
      { x: 380, y: 62 },
    ],
    score: 0,
  };
}

function spawnObstacle(g: Game): Obstacle {
  const allowBird = g.score >= BIRD_MIN_SCORE;
  if (allowBird && Math.random() < 0.28) {
    // Three classic bird heights: duck-or-jump, jumpable, run-under.
    const tops = [GROUND - 26, GROUND - 52, GROUND - 86];
    const y = tops[Math.floor(Math.random() * tops.length)];
    return { kind: "bird", x: W + 10, y, w: 30, h: 22, passed: false };
  }
  // Cactus: single small, single big, or a small cluster.
  const roll = Math.random();
  if (roll < 0.4) {
    return { kind: "cactus", x: W + 10, y: GROUND - 32, w: 15, h: 32, passed: false };
  }
  if (roll < 0.75) {
    return { kind: "cactus", x: W + 10, y: GROUND - 44, w: 21, h: 44, passed: false };
  }
  const count = 2 + (Math.random() < 0.4 ? 1 : 0);
  const w = count * 15 + (count - 1) * 4;
  return { kind: "cactus", x: W + 10, y: GROUND - 32, w, h: 32, passed: false };
}

export function DinoGame({
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
  const [shameMsg, setShameMsg] = useState<string | null>(null);

  function jump() {
    const g = game.current;
    if (g.phase === "over") return;
    if (g.phase === "idle") {
      g.phase = "playing";
      setPhase("playing");
    }
    if (!g.airborne) {
      g.vy = JUMP_V;
      g.airborne = true;
      g.ducking = false;
    }
  }

  function setDuck(down: boolean) {
    const g = game.current;
    if (g.phase !== "playing") return;
    g.ducking = down;
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
    void submitGameScore({
      roomId,
      gameKey: "dino",
      score: final,
      durationSeconds: Math.round(g.scoreTicks / 60),
    }).then((res) => {
      if (!res.ok) return;
      toast.success(copy.games.dino.saved(final));
      if (final > best) {
        setBest(final);
        if (final > 0) toast.success(copy.games.dino.newBest);
      } else if (final > 0 && best > 0) {
        setShameMsg(pickShameMsg());
      }
    });
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
      g.ticks += 1;
      g.speed = Math.min(MAX_SPEED, g.speed + SPEED_RAMP);

      // Dino vertical motion; holding duck mid-air slams down faster.
      if (g.airborne) {
        g.vy += GRAVITY + (g.ducking ? FAST_FALL : 0);
        g.y += g.vy;
        const standTop = GROUND - STAND_H;
        if (g.y >= standTop) {
          g.y = standTop;
          g.vy = 0;
          g.airborne = false;
        }
      }

      // Spawn when the last obstacle has moved far enough in.
      const lastObs = g.obstacles[g.obstacles.length - 1];
      const gap = 240 + g.speed * 22 + Math.random() * 160;
      if (!lastObs || lastObs.x < W - gap) {
        g.obstacles.push(spawnObstacle(g));
      }
      for (const o of g.obstacles) {
        o.x -= g.speed + (o.kind === "bird" ? 0.6 : 0);
      }
      g.obstacles = g.obstacles.filter((o) => o.x + o.w > -10);

      for (const c of g.clouds) {
        c.x -= g.speed * 0.18;
        if (c.x < -60) {
          c.x = W + 30 + Math.random() * 80;
          c.y = 30 + Math.random() * 50;
        }
      }

      // Hitbox: ducking shrinks the dino; small padding keeps it forgiving.
      const dw = g.ducking && !g.airborne ? DUCK_W : STAND_W;
      const dh = g.ducking && !g.airborne ? DUCK_H : STAND_H;
      const dTop = g.ducking && !g.airborne ? GROUND - DUCK_H : g.y;
      const pad = 3;
      for (const o of g.obstacles) {
        if (!o.passed && o.x + o.w < DINO_X) {
          o.passed = true;
          g.score += 1;
          g.scoreTicks = g.ticks;
          setScore(g.score);
        }
        const hit =
          DINO_X + pad < o.x + o.w &&
          DINO_X + dw - pad > o.x &&
          dTop + pad < o.y + o.h &&
          dTop + dh - pad > o.y;
        if (hit) {
          endGame();
          return;
        }
      }
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

    function onKeyDown(e: KeyboardEvent) {
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        jump();
      } else if (e.code === "ArrowDown") {
        e.preventDefault();
        setDuck(true);
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.code === "ArrowDown") setDuck(false);
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-2">
      {shameMsg && (
        <ShameModal message={shameMsg} onDone={() => setShameMsg(null)} />
      )}
      <div className="flex items-center justify-between text-sm">
        <span className="font-mono tabular-nums">
          {copy.games.dino.score}: <b>{score}</b>
        </span>
        <span className="font-mono tabular-nums text-muted-foreground">
          {copy.games.dino.best}: {best}
        </span>
      </div>
      <div
        className="relative mx-auto w-full max-w-[600px] cursor-pointer select-none touch-none"
        onPointerDown={(e) => {
          e.preventDefault();
          jump();
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
                <p className="text-lg font-bold">{copy.games.dino.gameOver}</p>
                <p className="font-mono">
                  {copy.games.dino.score}: {score}
                </p>
                <Button onClick={restart}>{copy.games.dino.restart}</Button>
              </>
            ) : (
              <p className="px-4 text-sm font-medium">
                {copy.games.dino.tapToStart}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function draw(ctx: CanvasRenderingContext2D, g: Game) {
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  // Clouds
  ctx.fillStyle = "#d8d8d8";
  for (const c of g.clouds) {
    ctx.fillRect(c.x, c.y, 36, 6);
    ctx.fillRect(c.x + 8, c.y - 5, 20, 5);
  }

  // Ground: a line with dashes drifting along with the run.
  ctx.fillStyle = FG;
  ctx.fillRect(0, GROUND, W, 2);
  const shift = (g.ticks * g.speed) % 28;
  for (let x = -shift; x < W; x += 28) {
    ctx.fillRect(x, GROUND + 6, 8, 2);
  }

  for (const o of g.obstacles) {
    if (o.kind === "cactus") drawCactus(ctx, o);
    else drawBird(ctx, o, g.ticks);
  }

  drawDino(ctx, g);
}

function drawCactus(ctx: CanvasRenderingContext2D, o: Obstacle) {
  ctx.fillStyle = FG;
  // One trunk per ~15px of width (clusters render as several stems).
  for (let x = o.x; x < o.x + o.w; x += 19) {
    const stemW = 8;
    ctx.fillRect(x + 3, o.y, stemW, o.h);
    // Arms
    ctx.fillRect(x, o.y + 8, 4, 3);
    ctx.fillRect(x, o.y + 4, 3, 7);
    ctx.fillRect(x + 3 + stemW, o.y + 12, 4, 3);
    ctx.fillRect(x + 4 + stemW, o.y + 6, 3, 9);
  }
}

function drawBird(ctx: CanvasRenderingContext2D, o: Obstacle, ticks: number) {
  ctx.fillStyle = FG;
  const flapUp = Math.floor(ticks / 12) % 2 === 0;
  // Body + beak
  ctx.fillRect(o.x + 4, o.y + 8, 22, 7);
  ctx.fillRect(o.x, o.y + 9, 5, 4);
  ctx.fillRect(o.x + 24, o.y + 5, 6, 5);
  // Wing (two flap frames)
  if (flapUp) ctx.fillRect(o.x + 10, o.y, 8, 9);
  else ctx.fillRect(o.x + 10, o.y + 14, 8, 8);
}

function drawDino(ctx: CanvasRenderingContext2D, g: Game) {
  ctx.fillStyle = FG;
  const ducking = g.ducking && !g.airborne;
  const running = g.phase === "playing" && !g.airborne;
  const legPhase = running ? Math.floor(g.ticks / 6) % 2 : 0;

  if (ducking) {
    const top = GROUND - DUCK_H;
    // Long low body with the head stretched forward
    ctx.fillRect(DINO_X, top + 4, DUCK_W - 10, DUCK_H - 10);
    ctx.fillRect(DINO_X + DUCK_W - 14, top, 14, 10);
    // Eye
    ctx.fillStyle = BG;
    ctx.fillRect(DINO_X + DUCK_W - 5, top + 2, 2, 2);
    ctx.fillStyle = FG;
    // Legs
    if (legPhase === 0) {
      ctx.fillRect(DINO_X + 4, GROUND - 6, 4, 6);
      ctx.fillRect(DINO_X + 14, GROUND - 4, 4, 4);
    } else {
      ctx.fillRect(DINO_X + 4, GROUND - 4, 4, 4);
      ctx.fillRect(DINO_X + 14, GROUND - 6, 4, 6);
    }
    return;
  }

  const top = g.y;
  // Tail, body, head
  ctx.fillRect(DINO_X - 6, top + 12, 8, 6);
  ctx.fillRect(DINO_X, top + 8, 14, 18);
  ctx.fillRect(DINO_X + 8, top, 14, 12);
  // Eye
  ctx.fillStyle = BG;
  ctx.fillRect(DINO_X + 16, top + 3, 2, 2);
  ctx.fillStyle = FG;
  // Tiny arm
  ctx.fillRect(DINO_X + 13, top + 14, 5, 3);
  // Legs (alternate while running, both down in the air)
  if (g.airborne || legPhase === 0) {
    ctx.fillRect(DINO_X + 2, top + 26, 4, STAND_H - 26);
    ctx.fillRect(DINO_X + 9, top + 26, 4, STAND_H - 26);
  } else {
    ctx.fillRect(DINO_X + 2, top + 26, 4, STAND_H - 30);
    ctx.fillRect(DINO_X + 9, top + 26, 4, STAND_H - 26);
  }
}
