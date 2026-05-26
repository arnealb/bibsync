"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { submitGameScore } from "@/app/_actions/games";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import {
  EMPTY,
  canConnect,
  hasAnyMove,
  isCleared,
  makeBoard,
  removePair,
  shuffleRemaining,
  tilesLeft,
  type Grid,
  type Point,
} from "@/lib/petconnect/engine";
import { cn } from "@/lib/utils";

const CELL = 36;

const SIZES = {
  klein: { rows: 5, cols: 6, label: "Klein" },
  middel: { rows: 6, cols: 8, label: "Middel" },
  groot: { rows: 8, cols: 10, label: "Groot" },
} as const;
type SizeKey = keyof typeof SIZES;

const PETS_EMOJI = [
  "🐶", "🐱", "🐰", "🦊", "🐼", "🐸",
  "🐵", "🐧", "🐢", "🦄", "🐝", "🦉",
];

function petsFor(rows: number, cols: number): number {
  return Math.min(PETS_EMOJI.length, (rows * cols) / 2);
}

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

// Module-scope wrappers so the impure source isn't called directly in render.
function now(): number {
  return Date.now();
}
function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0]!;
}

export function PetConnectBoard({
  roomId,
  seed,
}: {
  roomId: string;
  seed: number;
}) {
  const router = useRouter();
  const [size, setSize] = useState<SizeKey>("middel");
  const [grid, setGrid] = useState<Grid>(() =>
    makeBoard(
      SIZES.middel.rows,
      SIZES.middel.cols,
      petsFor(SIZES.middel.rows, SIZES.middel.cols),
      lcg(seed),
    ),
  );
  const [selected, setSelected] = useState<Point | null>(null);
  const [path, setPath] = useState<Point[] | null>(null);
  const [won, setWon] = useState<number | null>(null);
  const [seconds, setSeconds] = useState(0);
  const startRef = useRef(0);
  const pathTimer = useRef<number | undefined>(undefined);
  const [, startSubmit] = useTransition();

  useEffect(() => {
    if (won !== null) return;
    if (startRef.current === 0) startRef.current = now();
    const id = window.setInterval(() => {
      setSeconds(Math.floor((now() - startRef.current) / 1000));
    }, 250);
    return () => window.clearInterval(id);
  }, [won]);

  function flashPath(p: Point[]) {
    setPath(p);
    if (pathTimer.current) window.clearTimeout(pathTimer.current);
    pathTimer.current = window.setTimeout(() => setPath(null), 220);
  }

  function finish() {
    const elapsed = (now() - startRef.current) / 1000;
    const score = Math.max(50, Math.round(3000 - elapsed * 10));
    setSeconds(Math.floor(elapsed));
    setWon(score);
    startSubmit(async () => {
      await submitGameScore({ roomId, gameKey: "petconnect", score });
      toast.success(copy.petconnect.won(score));
      router.refresh();
    });
  }

  function handleClick(r: number, c: number) {
    if (won !== null || grid[r]![c] === EMPTY) return;
    if (selected && selected.r === r && selected.c === c) {
      setSelected(null);
      return;
    }
    if (!selected) {
      setSelected({ r, c });
      return;
    }
    const connectPath = canConnect(grid, selected, { r, c });
    if (!connectPath) {
      setSelected({ r, c }); // re-select instead
      return;
    }
    // Valid match: clear immediately so play stays snappy; the path only flashes.
    const next = removePair(grid, selected, { r, c });
    setGrid(next);
    setSelected(null);
    flashPath(connectPath);
    if (isCleared(next)) finish();
  }

  function startGame(key: SizeKey) {
    const { rows, cols } = SIZES[key];
    setSize(key);
    setGrid(makeBoard(rows, cols, petsFor(rows, cols), lcg(randomSeed())));
    setSelected(null);
    setPath(null);
    setWon(null);
    setSeconds(0);
    startRef.current = now();
  }

  function shuffle() {
    setGrid((g) => shuffleRemaining(g, lcg(randomSeed())));
    setSelected(null);
  }

  const left = tilesLeft(grid);
  const stuck = won === null && left > 0 && !hasAnyMove(grid);
  const W = grid[0]!.length;
  const H = grid.length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-lg font-bold tabular-nums">
          ⏱ {copy.petconnect.seconds(seconds)}
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            {copy.petconnect.left(left)}
          </span>
        </span>
        <div className="flex gap-1.5">
          {(Object.keys(SIZES) as SizeKey[]).map((key) => (
            <Button
              key={key}
              size="sm"
              variant={size === key ? "default" : "outline"}
              onClick={() => startGame(key)}
            >
              {SIZES[key].label}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        {stuck ? (
          <span className="text-xs text-amber-500">
            {copy.petconnect.shuffleHint}
          </span>
        ) : (
          <span />
        )}
        <Button size="sm" variant="outline" onClick={shuffle} disabled={won !== null}>
          {copy.petconnect.shuffle}
        </Button>
      </div>

      <div className="overflow-x-auto">
        <div
          className="relative mx-auto rounded-lg bg-emerald-950/20"
          style={{
            width: W * CELL,
            height: H * CELL,
            display: "grid",
            gridTemplateColumns: `repeat(${W}, ${CELL}px)`,
          }}
        >
          {grid.flatMap((row, r) =>
            row.map((val, c) => {
              if (val === EMPTY) return <div key={`${r}-${c}`} />;
              const isSel = selected?.r === r && selected?.c === c;
              return (
                <button
                  key={`${r}-${c}`}
                  type="button"
                  onClick={() => handleClick(r, c)}
                  className={cn(
                    "m-[2px] flex select-none items-center justify-center rounded-md border bg-card text-lg transition-colors",
                    isSel
                      ? "border-amber-400 ring-2 ring-amber-400"
                      : "border-border hover:border-amber-400/50",
                  )}
                  style={{ width: CELL - 4, height: CELL - 4 }}
                >
                  {PETS_EMOJI[val - 1]}
                </button>
              );
            }),
          )}

          {path && (
            <svg
              className="pointer-events-none absolute inset-0"
              width={W * CELL}
              height={H * CELL}
            >
              <polyline
                points={path
                  .map((p) => `${p.c * CELL + CELL / 2},${p.r * CELL + CELL / 2}`)
                  .join(" ")}
                fill="none"
                stroke="#fbbf24"
                strokeWidth={3}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </svg>
          )}
        </div>
      </div>

      {won !== null && (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-center text-sm font-medium">
          {copy.petconnect.won(won)} · ⏱ {copy.petconnect.seconds(seconds)}
        </div>
      )}
    </div>
  );
}
