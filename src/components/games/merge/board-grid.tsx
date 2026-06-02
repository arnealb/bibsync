"use client";

import { BOARD_COLS, GENERATOR_EMOJI, itemEmoji } from "@/lib/merge/config";
import type { MergeCell } from "@/lib/merge/types";
import { cn } from "@/lib/utils";

/** Tier → a subtle background tint so higher items read as more "valuable". */
const TIER_TINT = [
  "bg-muted",
  "bg-emerald-500/10",
  "bg-sky-500/10",
  "bg-violet-500/10",
  "bg-amber-500/10",
  "bg-rose-500/15",
];

function CellContent({ cell }: { cell: MergeCell }) {
  if (cell === null) return null;
  if (cell.kind === "gen") {
    return <span className="text-2xl sm:text-3xl">{GENERATOR_EMOJI}</span>;
  }
  return (
    <span className="relative text-2xl leading-none sm:text-3xl">
      {itemEmoji(cell.family, cell.tier)}
      <span className="absolute -right-1.5 -bottom-1 rounded bg-background/80 px-0.5 text-[9px] font-bold tabular-nums text-muted-foreground">
        {cell.tier}
      </span>
    </span>
  );
}

/** The interactive board: tap the generator, tap-select then tap-target to merge. */
export function BoardGrid({
  cells,
  selected,
  pending,
  onCellClick,
}: {
  cells: MergeCell[];
  selected: number | null;
  pending: boolean;
  onCellClick: (index: number) => void;
}) {
  return (
    <div
      className="grid gap-1 sm:gap-1.5"
      style={{ gridTemplateColumns: `repeat(${BOARD_COLS}, minmax(0, 1fr))` }}
    >
      {cells.map((cell, i) => {
        const isGen = cell?.kind === "gen";
        const isItem = cell?.kind === "item";
        return (
          <button
            key={i}
            type="button"
            disabled={pending}
            onClick={() => onCellClick(i)}
            aria-label={`vakje ${i + 1}`}
            className={cn(
              "flex aspect-square items-center justify-center rounded-md border transition",
              "disabled:opacity-60",
              isItem && cell ? TIER_TINT[Math.min(cell.tier - 1, TIER_TINT.length - 1)] : "bg-card",
              isGen && "border-fuchsia-500/50 bg-fuchsia-500/10 hover:bg-fuchsia-500/20",
              selected === i && "ring-2 ring-primary ring-offset-1 ring-offset-background",
              !cell && "border-dashed",
            )}
          >
            <CellContent cell={cell} />
          </button>
        );
      })}
    </div>
  );
}
