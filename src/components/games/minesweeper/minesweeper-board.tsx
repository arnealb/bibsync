"use client";

import { useRef } from "react";

import { copy } from "@/lib/copy";
import type { MinesweeperState } from "@/lib/games/minesweeper/engine";
import { cn } from "@/lib/utils";

/** Classic Windows number colours, tuned for the dark slate board. */
const NUMBER_COLOURS: Record<number, string> = {
  1: "#8ab4f8", // blue
  2: "#81c995", // green
  3: "#f28b82", // red
  4: "#c58af9", // purple
  5: "#ee675c", // maroon
  6: "#78d9c8", // teal
  7: "#f8f9fa", // black → white on dark
  8: "#bdc1c6", // grey
};

const LONG_PRESS_MS = 350;

interface MinesweeperBoardProps {
  state: MinesweeperState;
  onReveal: (r: number, c: number) => void;
  onFlag: (r: number, c: number) => void;
}

/**
 * The minefield. Tap/click reveals, right-click or long-press flags (the game
 * component may swap reveal/flag when flag mode is on).
 */
export function MinesweeperBoard({
  state,
  onReveal,
  onFlag,
}: MinesweeperBoardProps) {
  const longPress = useRef<{ timer: number; fired: boolean } | null>(null);
  const ended = state.status === "won" || state.status === "lost";

  function startPress(r: number, c: number) {
    cancelPress();
    longPress.current = {
      fired: false,
      timer: window.setTimeout(() => {
        if (longPress.current) longPress.current.fired = true;
        onFlag(r, c);
      }, LONG_PRESS_MS),
    };
  }

  function cancelPress() {
    if (longPress.current) window.clearTimeout(longPress.current.timer);
  }

  function endPress(r: number, c: number) {
    cancelPress();
    if (!longPress.current?.fired) onReveal(r, c);
    longPress.current = null;
  }

  return (
    <div
      role="grid"
      aria-label={copy.games.minesweeper.title}
      className="grid touch-manipulation select-none gap-0 rounded-sm border-2 border-t-[#1f242d] border-l-[#1f242d] border-b-[#5d6675] border-r-[#5d6675] bg-[#2b313c] p-0.5"
      style={{ gridTemplateColumns: `repeat(${state.cols}, minmax(0, 1fr))` }}
    >
      {state.board.map((row, r) =>
        row.map((cell, c) => (
          <button
            key={`${r}-${c}`}
            type="button"
            role="gridcell"
            disabled={ended}
            aria-label={cellLabel(cell)}
            onContextMenu={(e) => {
              // Right-click flags; skip when the long-press already flagged
              // (Android fires contextmenu after a long touch press too).
              e.preventDefault();
              if (!ended && !longPress.current?.fired) onFlag(r, c);
            }}
            onPointerDown={(e) => {
              if (!ended && e.button === 0) startPress(r, c);
            }}
            onPointerUp={(e) => {
              if (!ended && e.button === 0) endPress(r, c);
            }}
            onPointerLeave={cancelPress}
            onPointerCancel={cancelPress}
            className={cn(
              "flex aspect-square items-center justify-center font-mono text-[clamp(0.7rem,3.2vw,1.05rem)] font-extrabold leading-none",
              cell.revealed
                ? "border border-[#3a414e] bg-[#343b47]"
                : "border-2 border-t-[#79839a] border-l-[#79839a] border-b-[#232831] border-r-[#232831] bg-[#4d5564] active:border active:border-[#3a414e]",
              cell.exploded && "bg-[#b3261e]",
            )}
            style={
              cell.revealed && !cell.mine && cell.adjacent > 0
                ? { color: NUMBER_COLOURS[cell.adjacent] }
                : undefined
            }
          >
            {cellGlyph(cell, state.status)}
          </button>
        )),
      )}
    </div>
  );
}

function cellGlyph(
  cell: MinesweeperState["board"][number][number],
  status: MinesweeperState["status"],
): string {
  // A wrong flag is exposed when the game is lost.
  if (cell.flagged && !cell.mine && status === "lost") return "❌";
  if (cell.flagged) return "🚩";
  if (!cell.revealed) return "";
  if (cell.mine) return "💣";
  return cell.adjacent > 0 ? String(cell.adjacent) : "";
}

function cellLabel(cell: MinesweeperState["board"][number][number]): string {
  if (cell.flagged) return copy.games.minesweeper.cellFlagged;
  if (!cell.revealed) return copy.games.minesweeper.cellHidden;
  if (cell.mine) return copy.games.minesweeper.cellMine;
  return String(cell.adjacent);
}
