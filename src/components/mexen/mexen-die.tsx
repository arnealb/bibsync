"use client";

import { cn } from "@/lib/utils";

/** Dot layouts per pip (3×3 grid cells that are filled). */
const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

/** A single die face. Clickable to toggle "laten liggen" (kept) when allowed. */
export function MexenDie({
  value,
  kept = false,
  onClick,
  disabled,
}: {
  value: number | null;
  kept?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const interactive = !!onClick && !disabled;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!interactive}
      aria-pressed={kept}
      className={cn(
        "grid size-16 grid-cols-3 grid-rows-3 gap-0.5 rounded-xl border-2 bg-background p-2 shadow-sm transition",
        kept
          ? "border-amber-400 ring-2 ring-amber-400/40"
          : "border-border",
        interactive && "cursor-pointer hover:border-amber-400/60",
        !interactive && "cursor-default",
      )}
    >
      {Array.from({ length: 9 }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "size-2 self-center justify-self-center rounded-full",
            value !== null && PIPS[value]?.includes(i)
              ? "bg-foreground"
              : "bg-transparent",
          )}
        />
      ))}
    </button>
  );
}
