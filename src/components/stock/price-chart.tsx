import { copy } from "@/lib/copy";
import type { StockTick } from "@/lib/stock/types";
import { cn } from "@/lib/utils";

/** A tiny dependency-free SVG area chart of the price history. */
export function PriceChart({ ticks }: { ticks: StockTick[] }) {
  if (ticks.length < 2) {
    return (
      <div className="flex h-32 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
        {copy.stock.empty}
      </div>
    );
  }

  const W = 300;
  const H = 96;
  const prices = ticks.map((t) => t.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const span = max - min || 1;
  const up = prices[prices.length - 1]! >= prices[0]!;

  const x = (i: number) => (i / (ticks.length - 1)) * W;
  const y = (p: number) => H - ((p - min) / span) * (H - 8) - 4;

  const line = prices.map((p, i) => `${x(i)},${y(p)}`).join(" ");
  const area = `0,${H} ${line} ${W},${H}`;
  const stroke = up ? "rgb(34,197,94)" : "rgb(239,68,68)";
  const fillId = up ? "stockUp" : "stockDown";

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="h-32 w-full"
      role="img"
      aria-label={copy.stock.price}
    >
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.25" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${fillId})`} />
      <polyline
        points={line}
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        className={cn(up ? "text-green-500" : "text-red-500")}
      />
    </svg>
  );
}
