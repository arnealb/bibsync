"use client";

import { useMemo, useState } from "react";
import { Coins, UtensilsCrossed } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { copy } from "@/lib/copy";
import { FOOD_BET_MIN } from "@/lib/validation/food-bets";
import { cn } from "@/lib/utils";
import type { FoodPlaceBet, RoomPlace } from "@/types/database";

interface Ranked {
  place: string;
  total: number;
  you: number;
}

export function FoodBets({
  bets,
  places,
  userId,
  canParticipate,
  pending,
  onStake,
}: {
  bets: FoodPlaceBet[];
  places: RoomPlace[];
  userId: string;
  canParticipate: boolean;
  pending: boolean;
  onStake: (place: string, amount: number) => void;
}) {
  const [place, setPlace] = useState("");
  const [amount, setAmount] = useState(FOOD_BET_MIN);

  const ranked = useMemo<Ranked[]>(() => {
    const totals = new Map<string, number>();
    const mine = new Map<string, number>();
    for (const b of bets) {
      totals.set(b.place, (totals.get(b.place) ?? 0) + b.amount);
      if (b.user_id === userId) {
        mine.set(b.place, (mine.get(b.place) ?? 0) + b.amount);
      }
    }
    return [...totals.entries()]
      .map(([p, total]) => ({ place: p, total, you: mine.get(p) ?? 0 }))
      .sort((a, b) => b.total - a.total);
  }, [bets, userId]);

  const max = ranked[0]?.total ?? 0;

  // Suggestion chips: existing bet places + the room's saved (non-walk) places.
  const chips = useMemo(() => {
    const seen = new Set(ranked.map((r) => r.place.toLowerCase()));
    const out = ranked.map((r) => r.place);
    for (const p of places) {
      if (!seen.has(p.name.toLowerCase())) {
        seen.add(p.name.toLowerCase());
        out.push(p.name);
      }
    }
    return out.slice(0, 8);
  }, [ranked, places]);

  function submit() {
    const trimmed = place.trim();
    if (trimmed && amount >= FOOD_BET_MIN) onStake(trimmed, amount);
    setPlace("");
  }

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-dashed p-3">
      <div className="flex items-center gap-1.5 text-sm font-medium">
        <UtensilsCrossed className="size-4 text-amber-500" />
        {copy.foodBets.title}
      </div>

      {ranked.length === 0 ? (
        <p className="text-xs text-muted-foreground">{copy.foodBets.empty}</p>
      ) : (
        <ul className="space-y-1.5">
          {ranked.map((r, i) => (
            <li key={r.place} className="space-y-0.5">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="flex min-w-0 items-center gap-1.5 truncate">
                  {i === 0 && max > 0 && <span aria-hidden>👑</span>}
                  <span className="truncate font-medium">{r.place}</span>
                  {r.you > 0 && (
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      ({copy.foodBets.yourStake(r.you)})
                    </span>
                  )}
                </span>
                <span className="flex shrink-0 items-center gap-1 font-mono text-xs font-semibold tabular-nums text-amber-500">
                  <Coins className="size-3.5" />
                  {r.total}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full",
                    i === 0 ? "bg-amber-500" : "bg-muted-foreground/40",
                  )}
                  style={{ width: `${max > 0 ? (r.total / max) * 100 : 0}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      {canParticipate && (
        <div className="space-y-1.5">
          {chips.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {chips.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setPlace(c)}
                  className="rounded-full border px-2 py-0.5 text-xs hover:bg-muted"
                >
                  {c}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <Input
              value={place}
              maxLength={80}
              onChange={(e) => setPlace(e.target.value)}
              placeholder={copy.foodBets.placePlaceholder}
              className="h-8 flex-1"
            />
            <Input
              type="number"
              min={FOOD_BET_MIN}
              value={amount}
              onChange={(e) =>
                setAmount(Math.max(0, Math.floor(Number(e.target.value) || 0)))
              }
              className="h-8 w-20"
              aria-label={copy.foodBets.amountPlaceholder}
            />
            <Button
              size="sm"
              disabled={pending || !place.trim() || amount < FOOD_BET_MIN}
              onClick={submit}
            >
              {copy.foodBets.stake}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
