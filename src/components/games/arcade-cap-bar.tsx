"use client";

import { useEffect, useState } from "react";

import { getArcadeHourEarned } from "@/app/_actions/arcade";
import { ARCADE_HOURLY_CAP } from "@/lib/bibcoins/config";
import { copy } from "@/lib/copy";
import { msUntilHourReset } from "@/lib/games/arcade-window";

const POLL_TICKS = 15; // refetch the earned total every 15 seconds

export function ArcadeCapBar() {
  const [earned, setEarned] = useState<number | null>(null);
  const [msLeft, setMsLeft] = useState(() => msUntilHourReset(Date.now()));

  useEffect(() => {
    let active = true;
    const refetch = () => {
      void getArcadeHourEarned().then((n) => {
        if (active) setEarned(n);
      });
    };
    refetch();

    let tick = 0;
    let prev = msUntilHourReset(Date.now());
    const id = window.setInterval(() => {
      const left = msUntilHourReset(Date.now());
      if (left > prev) refetch(); // hour rolled over → earnings reset to 0
      prev = left;
      setMsLeft(left);
      tick = (tick + 1) % POLL_TICKS;
      if (tick === 0) refetch();
    }, 1000);

    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, []);

  const value = earned ?? 0;
  const pct = Math.min(100, Math.round((value / ARCADE_HOURLY_CAP) * 100));
  const atCap = value >= ARCADE_HOURLY_CAP;
  const mins = Math.floor(msLeft / 60_000);
  const secs = Math.floor((msLeft % 60_000) / 1000);

  return (
    <div className="space-y-1 rounded-lg border p-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{copy.games.cap.label}</span>
        <span className="font-mono tabular-nums font-medium">
          {earned == null ? "…" : value} / {ARCADE_HOURLY_CAP}
        </span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label={copy.games.cap.label}
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={ARCADE_HOURLY_CAP}
      >
        <div
          className={`h-full rounded-full transition-all ${atCap ? "bg-destructive" : "bg-primary"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground tabular-nums">
        {copy.games.cap.resetIn(mins, secs)}
      </p>
    </div>
  );
}
