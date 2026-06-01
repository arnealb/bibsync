import { Crown } from "lucide-react";

import { copy } from "@/lib/copy";
import { cn } from "@/lib/utils";

/**
 * Gold crown badge for a game's reigning #1 honest scorer. `label` is the crown
 * text (e.g. "Snake King"); `reward` is the daily bibcoins payout (tooltip).
 * Kept in sync with the cron jobs in 0047/0050.
 */
export function KingBadge({
  reward,
  label,
  className,
}: {
  reward: number;
  label: string;
  className?: string;
}) {
  const tooltip = copy.games.king.tooltip(label, reward);
  return (
    <span
      title={tooltip}
      aria-label={tooltip}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full bg-gradient-to-r from-amber-300 to-yellow-500 px-1.5 py-0.5 text-[10px] font-bold text-amber-950 shadow-sm ring-1 ring-amber-500/40",
        className,
      )}
    >
      <Crown className="size-3 fill-amber-950" aria-hidden />
      {label}
    </span>
  );
}
