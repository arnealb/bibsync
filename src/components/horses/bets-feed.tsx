"use client";

import { HORSE_COLOR_UI } from "@/components/horses/colors";
import { copy } from "@/lib/copy";
import type { RaceHorse } from "@/lib/horses/engine";
import type { HorseBetView } from "@/lib/horses/queries";
import { cn } from "@/lib/utils";

/** Social betting feed: who staked what on which horse (+ result chips). */
export function BetsFeed({
  bets,
  horses,
  names,
  myUserId,
}: {
  bets: HorseBetView[];
  horses: RaceHorse[];
  names: string[];
  myUserId: string;
}) {
  if (bets.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{copy.horses.noBets}</p>
    );
  }

  return (
    <ul className="max-h-52 space-y-1 overflow-y-auto text-sm">
      {bets.map((b) => {
        const horse = horses[b.horseIdx];
        const ui = horse ? HORSE_COLOR_UI[horse.color] : null;
        return (
          <li
            key={b.id}
            className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-2 py-1"
          >
            <span className="min-w-0 truncate">
              <span className="font-medium">
                {b.name}
                {b.userId === myUserId && (
                  <span className="text-muted-foreground">
                    {" "}
                    ({copy.horses.yourBet})
                  </span>
                )}
              </span>{" "}
              <span className={cn("font-medium", ui?.text)}>
                · {names[b.horseIdx] ?? "?"}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-2 tabular-nums">
              <span className="text-muted-foreground">{b.amount}</span>
              {b.payout !== null &&
                (b.payout > 0 ? (
                  <span className="font-semibold text-emerald-500">
                    {copy.horses.wonBadge(b.payout)}
                  </span>
                ) : (
                  <span className="text-[11px] text-muted-foreground">
                    {copy.horses.lostBadge}
                  </span>
                ))}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
