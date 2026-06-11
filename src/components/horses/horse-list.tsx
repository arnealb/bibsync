"use client";

import { HORSE_COLOR_UI } from "@/components/horses/colors";
import { copy } from "@/lib/copy";
import { HORSE_STAT_MAX, HORSE_STAT_MIN } from "@/lib/horses/config";
import { multLabel, type RaceHorse } from "@/lib/horses/engine";
import { cn } from "@/lib/utils";

function StatBar({
  label,
  value,
  barClass,
}: {
  label: string;
  value: number;
  barClass: string;
}) {
  const pct =
    ((value - HORSE_STAT_MIN) / (HORSE_STAT_MAX - HORSE_STAT_MIN)) * 100;
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-[9px] uppercase tracking-wide text-muted-foreground">
        <span>{label}</span>
        <span className="tabular-nums">{value}</span>
      </div>
      <div className="h-1 rounded-full bg-muted">
        <div
          className={cn("h-1 rounded-full", barClass)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/** Selectable cards for the six horses: stats, odds, win chance and pool. */
export function HorseList({
  horses,
  names,
  pools,
  selected,
  onSelect,
  disabled,
}: {
  horses: RaceHorse[];
  names: string[];
  pools: number[];
  selected: number | null;
  onSelect: (idx: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {horses.map((h, i) => {
        const ui = HORSE_COLOR_UI[h.color];
        return (
          <button
            key={h.color}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(i)}
            className={cn(
              "rounded-xl border p-3 text-left transition disabled:opacity-60",
              selected === i
                ? cn("ring-2", ui.ring)
                : "hover:bg-muted/50",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2">
                <span className={cn("size-3 shrink-0 rounded-full", ui.dot)} />
                <span className="truncate text-sm font-semibold">
                  {names[i]}
                </span>
              </span>
              <span className={cn("text-sm font-bold tabular-nums", ui.text)}>
                {copy.horses.odds(multLabel(h.multBp))}
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {copy.horses.colors[h.color]} ·{" "}
              {copy.horses.winChance((h.winBp / 100).toFixed(1))}
            </p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <StatBar
                label={copy.horses.stats.speed}
                value={h.speed}
                barClass={ui.bar}
              />
              <StatBar
                label={copy.horses.stats.stamina}
                value={h.stamina}
                barClass={ui.bar}
              />
              <StatBar
                label={copy.horses.stats.sprint}
                value={h.sprint}
                barClass={ui.bar}
              />
            </div>
            {pools[i] > 0 && (
              <p className="mt-1.5 text-[11px] font-medium tabular-nums text-muted-foreground">
                💰 {copy.horses.pool(pools[i])}
              </p>
            )}
          </button>
        );
      })}
    </div>
  );
}
