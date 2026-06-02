"use client";

import { useEffect, useState } from "react";

import { copy } from "@/lib/copy";
import { msUntilHourReset } from "@/lib/games/arcade-window";
import { VOETBAL_HOURLY_CAP } from "@/lib/voetbal/config";

/** Hourly-cap progress for voetbal. `earned` is driven by the game's responses. */
export function VoetbalCapBar({ earned }: { earned: number }) {
  const [msLeft, setMsLeft] = useState(() => msUntilHourReset(Date.now()));

  useEffect(() => {
    const id = window.setInterval(
      () => setMsLeft(msUntilHourReset(Date.now())),
      1000,
    );
    return () => window.clearInterval(id);
  }, []);

  const pct = Math.min(100, Math.round((earned / VOETBAL_HOURLY_CAP) * 100));
  const atCap = earned >= VOETBAL_HOURLY_CAP;
  const mins = Math.floor(msLeft / 60_000);
  const secs = Math.floor((msLeft % 60_000) / 1000);

  return (
    <div className="space-y-1 rounded-lg border p-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{copy.games.cap.label}</span>
        <span className="font-mono font-medium tabular-nums">
          {earned} / {VOETBAL_HOURLY_CAP}
        </span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={earned}
        aria-valuemin={0}
        aria-valuemax={VOETBAL_HOURLY_CAP}
      >
        <div
          className={`h-full rounded-full transition-all ${atCap ? "bg-destructive" : "bg-primary"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs tabular-nums text-muted-foreground">
        {copy.games.cap.resetIn(mins, secs)}
      </p>
    </div>
  );
}
