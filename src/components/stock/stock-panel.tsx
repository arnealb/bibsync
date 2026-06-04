"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { ArrowDownRight, ArrowUpRight, Minus, Plus } from "lucide-react";
import { toast } from "sonner";

import { buyStock, getStockQuote, sellStock } from "@/app/_actions/stock";
import { PriceChart } from "@/components/stock/price-chart";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useStockRealtime } from "@/hooks/use-stock-realtime";
import { copy } from "@/lib/copy";
import type { StockQuote, StockTick } from "@/lib/stock/types";
import { cn } from "@/lib/utils";

const MAX_TICKS = 60;

function fmt(n: number): string {
  return Math.round(n).toLocaleString("nl-BE");
}
function fmtPrice(n: number): string {
  return n.toLocaleString("nl-BE", { maximumFractionDigits: 2 });
}

export function StockPanel({
  initialQuote,
  initialHistory,
}: {
  initialQuote: StockQuote;
  initialHistory: StockTick[];
}) {
  const [quote, setQuote] = useState(initialQuote);
  const [ticks, setTicks] = useState<StockTick[]>(initialHistory);
  const [qty, setQty] = useState(1);
  const [pending, start] = useTransition();
  const lastPrice = useRef(initialQuote.price);

  // Fold each observed price into the live chart (cap the window).
  const pushTick = useCallback((price: number) => {
    if (price === lastPrice.current) return;
    lastPrice.current = price;
    setTicks((prev) =>
      [...prev, { price, recordedAt: new Date().toISOString(), event: null }].slice(-MAX_TICKS),
    );
  }, []);

  const refresh = useCallback(() => {
    void getStockQuote().then((q) => {
      if (!q) return;
      setQuote(q);
      pushTick(q.price);
    });
  }, [pushTick]);

  // Poll for gambling-driven drift; refetch immediately on any trade/tick.
  useEffect(() => {
    const id = setInterval(refresh, 15_000);
    return () => clearInterval(id);
  }, [refresh]);
  useStockRealtime(refresh);

  function trade(kind: "buy" | "sell") {
    start(async () => {
      const res = await (kind === "buy" ? buyStock : sellStock)({ qty });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const prev = quote;
      setQuote(res.quote);
      pushTick(res.quote.price);
      const spent = Math.abs(res.quote.balance - prev.balance);
      toast.success(
        kind === "buy"
          ? copy.stock.bought(qty, spent)
          : copy.stock.sold(qty, spent),
      );
    });
  }

  const up = ticks.length >= 2 && ticks[ticks.length - 1]!.price >= ticks[0]!.price;
  const buyCost = Math.ceil(quote.price * qty);
  const avg = quote.myShares > 0 ? quote.myCostBasis / quote.myShares : 0;
  const pnlPositive = quote.myPnl >= 0;
  const overCap = quote.myShares + qty > quote.holdingCap;
  const feePct = `${(quote.feeDaily * 100).toLocaleString("nl-BE", {
    maximumFractionDigits: 2,
  })}%`;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 pt-6">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{copy.stock.price}</p>
              <p className="flex items-baseline gap-1 text-3xl font-bold tabular-nums">
                {fmtPrice(quote.price)}
                <span className="text-sm font-normal text-muted-foreground">
                  {copy.stock.perShare}
                </span>
              </p>
            </div>
            <span
              className={cn(
                "flex items-center gap-1 rounded-full px-2 py-1 text-sm font-medium",
                up
                  ? "bg-green-500/10 text-green-600 dark:text-green-400"
                  : "bg-red-500/10 text-red-600 dark:text-red-400",
              )}
            >
              {up ? (
                <ArrowUpRight className="size-4" />
              ) : (
                <ArrowDownRight className="size-4" />
              )}
              {copy.stock.houseProfit}: {fmt(quote.houseProfit)}
            </span>
          </div>

          <PriceChart ticks={ticks} />

          <div className="grid grid-cols-2 gap-2 text-sm">
            <Stat label={copy.stock.outstanding} value={fmt(quote.sharesOutstanding)} />
            <Stat label={copy.stock.wagered} value={fmt(quote.wagered)} />
          </div>
        </CardContent>
      </Card>

      {/* Your position */}
      <Card>
        <CardContent className="grid grid-cols-2 gap-3 pt-6 text-sm sm:grid-cols-4">
          <Stat label={copy.stock.yourShares} value={fmt(quote.myShares)} />
          <Stat label={copy.stock.yourValue} value={fmt(quote.myValue)} />
          <Stat
            label={copy.stock.avgPrice}
            value={quote.myShares > 0 ? fmtPrice(avg) : "—"}
          />
          <Stat
            label={copy.stock.pnl}
            value={`${pnlPositive ? "+" : ""}${fmt(quote.myPnl)}`}
            valueClass={
              quote.myShares === 0
                ? undefined
                : pnlPositive
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
            }
          />
        </CardContent>
      </Card>

      {/* Trade */}
      <Card>
        <CardContent className="space-y-3 pt-6">
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="outline"
              aria-label="−"
              disabled={pending || qty <= 1}
              onClick={() => setQty((q) => Math.max(1, q - 1))}
            >
              <Minus />
            </Button>
            <Input
              type="number"
              min={1}
              value={qty}
              onChange={(e) =>
                setQty(Math.max(1, Math.floor(Number(e.target.value) || 1)))
              }
              className="text-center tabular-nums"
              aria-label={copy.stock.qtyLabel}
            />
            <Button
              size="icon"
              variant="outline"
              aria-label="+"
              disabled={pending}
              onClick={() => setQty((q) => q + 1)}
            >
              <Plus />
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              disabled={pending || buyCost > quote.balance || overCap}
              onClick={() => trade("buy")}
            >
              {copy.stock.buy} · {fmt(buyCost)}
            </Button>
            <Button
              variant="secondary"
              disabled={pending || quote.myShares < qty}
              onClick={() => trade("sell")}
            >
              {copy.stock.sell}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            {copy.stock.balance}:{" "}
            <span className="font-medium text-foreground tabular-nums">
              {fmt(quote.balance)}
            </span>
          </p>
          <p className="text-xs text-muted-foreground">{copy.stock.hint}</p>
          <p className="text-xs text-amber-600 dark:text-amber-400">
            {copy.stock.feeNote(feePct)}
          </p>
          <p className="text-xs text-muted-foreground">
            {copy.stock.holdingCapNote(quote.holdingCap)}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("font-semibold tabular-nums", valueClass)}>{value}</p>
    </div>
  );
}
