"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { HORSE_COLOR_UI } from "@/components/horses/colors";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import { RACE_REPLAY_MS } from "@/lib/horses/config";
import {
  leaderAt,
  raceScript,
  scriptProgressAt,
  type HorseRace,
} from "@/lib/horses/engine";
import { cn } from "@/lib/utils";

/**
 * Replays a resolved race from its server seed — pure animation, every client
 * sees the same run and the stored winner always crosses the line first.
 */
export function RaceTrack({
  race,
  names,
  onFinished,
  onClose,
}: {
  race: HorseRace;
  names: string[];
  onFinished?: () => void;
  onClose: () => void;
}) {
  const [t, setT] = useState(0);
  const skipRef = useRef(false);
  const finishedRef = useRef(false);
  const onFinishedRef = useRef(onFinished);
  useEffect(() => {
    onFinishedRef.current = onFinished;
  });

  const winnerIdx = race.winnerIdx ?? 0;
  const script = useMemo(
    () => raceScript(race.runSeed ?? 1, race.horses, winnerIdx),
    [race.runSeed, race.horses, winnerIdx],
  );

  // The replay starts on mount — render with key={race.id} so a new race
  // remounts (and so resets) the track.
  useEffect(() => {
    let raf = 0;
    const startedAt = performance.now();
    const step = (now: number) => {
      const p = skipRef.current
        ? 1
        : Math.min((now - startedAt) / RACE_REPLAY_MS, 1);
      setT(p);
      if (p < 1) {
        raf = requestAnimationFrame(step);
      } else if (!finishedRef.current) {
        finishedRef.current = true;
        onFinishedRef.current?.();
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  const done = t >= 1;
  const commentary = done
    ? copy.horses.commentary.wins(names[winnerIdx])
    : t < 0.08
      ? copy.horses.commentary.start
      : t < 0.6
        ? copy.horses.commentary.leading(names[leaderAt(script, t)])
        : copy.horses.commentary.closing(names[leaderAt(script, t)]);

  return (
    <div className="space-y-2 rounded-xl border bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-sm font-medium">{commentary}</p>
        {done ? (
          <Button variant="outline" size="sm" onClick={onClose}>
            ✕
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              skipRef.current = true;
            }}
          >
            {copy.horses.skip}
          </Button>
        )}
      </div>
      <div className="space-y-1">
        {race.horses.map((h, i) => {
          const p = scriptProgressAt(script, i, t);
          const ui = HORSE_COLOR_UI[h.color];
          const isWinner = done && i === winnerIdx;
          return (
            <div key={h.color} className="grid grid-cols-[5.5rem_1fr] items-center gap-2">
              <span
                className={cn(
                  "flex items-center gap-1 truncate text-[11px]",
                  isWinner ? "font-bold" : "text-muted-foreground",
                )}
              >
                <span className={cn("size-2 shrink-0 rounded-full", ui.dot)} />
                {names[i]}
              </span>
              <div
                className={cn(
                  "relative h-8 overflow-hidden rounded",
                  isWinner ? "bg-amber-400/20" : "bg-muted/50",
                )}
              >
                <div className="absolute inset-y-0 right-[8%] w-px border-r-2 border-dashed border-foreground/30" />
                <span
                  className="absolute top-1/2 -translate-y-1/2 text-xl"
                  style={{ left: `calc(${(4 + p * 84).toFixed(2)}% - 0.5rem)` }}
                >
                  <span className="inline-block -scale-x-100">
                    {isWinner ? "🏇" : "🐎"}
                  </span>
                </span>
                {isWinner && (
                  <span className="absolute right-1 top-1/2 -translate-y-1/2 text-sm">
                    🏆
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-right text-[11px] text-muted-foreground">🏁</p>
    </div>
  );
}
