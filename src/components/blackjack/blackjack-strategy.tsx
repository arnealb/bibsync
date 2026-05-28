import { copy } from "@/lib/copy";
import { cn } from "@/lib/utils";

/**
 * Basic-strategy "cheat sheet" for the house rules in use (dealer stands on
 * soft 17, double allowed incl. after split, no surrender). Cells = the
 * statistically best move for your hand vs. the dealer's up-card.
 */

type Action = "H" | "S" | "D" | "Ds" | "P";

interface Row {
  label: string;
  actions: Action[]; // one per dealer up-card, in DEALER order
}

const DEALER = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "A"];

const CELL: Record<Action, string> = {
  H: "bg-rose-500/20 text-rose-700 dark:text-rose-300",
  S: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300",
  D: "bg-sky-500/25 text-sky-700 dark:text-sky-300",
  Ds: "bg-sky-500/25 text-sky-700 dark:text-sky-300",
  P: "bg-violet-500/25 text-violet-700 dark:text-violet-300",
};

const GLYPH: Record<Action, string> = { H: "K", S: "P", D: "D", Ds: "D/P", P: "Sp" };

const H: Action = "H";
const S: Action = "S";
const D: Action = "D";

const HARD: Row[] = [
  { label: "17+", actions: Array(10).fill(S) },
  { label: "13–16", actions: [S, S, S, S, S, H, H, H, H, H] },
  { label: "12", actions: [H, H, S, S, S, H, H, H, H, H] },
  { label: "11", actions: [D, D, D, D, D, D, D, D, D, H] },
  { label: "10", actions: [D, D, D, D, D, D, D, D, H, H] },
  { label: "9", actions: [H, D, D, D, D, H, H, H, H, H] },
  { label: "5–8", actions: Array(10).fill(H) },
];

const SOFT: Row[] = [
  { label: "A,8–A,9", actions: Array(10).fill(S) },
  { label: "A,7", actions: [S, "Ds", "Ds", "Ds", "Ds", S, S, H, H, H] },
  { label: "A,6", actions: [H, D, D, D, D, H, H, H, H, H] },
  { label: "A,4–A,5", actions: [H, H, D, D, D, H, H, H, H, H] },
  { label: "A,2–A,3", actions: [H, H, H, D, D, H, H, H, H, H] },
];

const PAIRS: Row[] = [
  { label: "A,A", actions: Array(10).fill("P") },
  { label: "10,10", actions: Array(10).fill(S) },
  { label: "9,9", actions: ["P", "P", "P", "P", "P", S, "P", "P", S, S] },
  { label: "8,8", actions: Array(10).fill("P") },
  { label: "7,7", actions: ["P", "P", "P", "P", "P", "P", H, H, H, H] },
  { label: "6,6", actions: ["P", "P", "P", "P", "P", H, H, H, H, H] },
  { label: "5,5", actions: [D, D, D, D, D, D, D, D, H, H] },
  { label: "4,4", actions: [H, H, H, "P", "P", H, H, H, H, H] },
  { label: "2,2 / 3,3", actions: ["P", "P", "P", "P", "P", "P", H, H, H, H] },
];

function StrategyTable({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold">{title}</p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-center text-[10px]">
          <thead>
            <tr>
              <th className="p-1 text-left font-normal text-muted-foreground">
                {copy.blackjack.strategy.dealerHeader}
              </th>
              {DEALER.map((d) => (
                <th key={d} className="p-1 font-semibold tabular-nums">
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <td className="p-1 text-left font-medium whitespace-nowrap">
                  {r.label}
                </td>
                {r.actions.map((a, i) => (
                  <td key={`${r.label}-${i}`} className="p-px">
                    <span
                      className={cn(
                        "flex h-5 items-center justify-center rounded-sm font-bold",
                        CELL[a],
                      )}
                    >
                      {GLYPH[a]}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LegendItem({ action }: { action: Action }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={cn(
          "flex size-4 items-center justify-center rounded-sm text-[9px] font-bold",
          CELL[action],
        )}
      >
        {GLYPH[action]}
      </span>
      {copy.blackjack.strategy.legend[action]}
    </span>
  );
}

export function BlackjackStrategy() {
  return (
    <div className="space-y-3 rounded-lg border bg-card p-3 shadow-sm">
      <p className="text-xs text-muted-foreground">
        {copy.blackjack.strategy.hint}
      </p>
      <StrategyTable title={copy.blackjack.strategy.hard} rows={HARD} />
      <StrategyTable title={copy.blackjack.strategy.soft} rows={SOFT} />
      <StrategyTable title={copy.blackjack.strategy.pairs} rows={PAIRS} />
      <div className="flex flex-wrap gap-x-3 gap-y-1.5 border-t pt-2 text-[11px] text-muted-foreground">
        <LegendItem action="H" />
        <LegendItem action="S" />
        <LegendItem action="D" />
        <LegendItem action="Ds" />
        <LegendItem action="P" />
      </div>
    </div>
  );
}
