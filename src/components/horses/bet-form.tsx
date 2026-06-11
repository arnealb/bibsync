"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { copy } from "@/lib/copy";
import {
  HORSES_CHIPS,
  HORSES_MAX_BET,
  HORSES_MIN_BET,
} from "@/lib/horses/config";
import { cn } from "@/lib/utils";

/** Stake amount + submit for the currently selected horse. */
export function BetForm({
  amount,
  onAmountChange,
  onSubmit,
  pending,
  disabled,
  potentialText,
}: {
  amount: number;
  onAmountChange: (n: number) => void;
  onSubmit: () => void;
  pending: boolean;
  disabled: boolean;
  potentialText: string | null;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor="horses-bet">{copy.horses.betLabel}</Label>
      <Input
        id="horses-bet"
        type="number"
        min={HORSES_MIN_BET}
        max={HORSES_MAX_BET}
        value={amount}
        onChange={(e) =>
          onAmountChange(Math.max(0, Math.floor(Number(e.target.value) || 0)))
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        {HORSES_CHIPS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onAmountChange(c)}
            className={cn(
              "size-9 rounded-full border-2 text-xs font-bold tabular-nums transition",
              amount === c
                ? "border-amber-400 bg-amber-400/20 text-amber-500"
                : "border-border text-muted-foreground hover:border-amber-400/50",
            )}
          >
            {c}
          </button>
        ))}
      </div>
      {potentialText && (
        <p className="text-xs font-medium text-muted-foreground">
          {potentialText}
        </p>
      )}
      <Button
        className="w-full"
        disabled={pending || disabled}
        onClick={onSubmit}
      >
        {pending ? copy.horses.betting : copy.horses.placeBet}
      </Button>
    </div>
  );
}
