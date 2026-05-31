import { Crown } from "lucide-react";

import { copy } from "@/lib/copy";
import { cn } from "@/lib/utils";

/**
 * Gold "Snake King" badge for the reigning #1 honest Snake scorer. Shown only
 * in the Snake leaderboard. `reward` is the daily bibcoins payout, used in the
 * tooltip (kept in sync with the cron in 0047_snake_king.sql).
 */
export function SnakeKingBadge({
  reward,
  className,
}: {
  reward: number;
  className?: string;
}) {
  const label = copy.games.snakeKing.tooltip(reward);
  return (
    <span
      title={label}
      aria-label={label}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full bg-gradient-to-r from-amber-300 to-yellow-500 px-1.5 py-0.5 text-[10px] font-bold text-amber-950 shadow-sm ring-1 ring-amber-500/40",
        className,
      )}
    >
      <Crown className="size-3 fill-amber-950" aria-hidden />
      {copy.games.snakeKing.label}
    </span>
  );
}
