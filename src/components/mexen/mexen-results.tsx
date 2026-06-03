"use client";

import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import type { MexenPlayer, RoundResolution } from "@/lib/mexen/game";

const FACE = ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

/** Build the Dutch effect lines for one player's throw. */
function effectLines(
  pp: RoundResolution["perPlayer"][number],
  nameOf: (id: string) => string,
): string[] {
  const lines: string[] = [];
  const me = nameOf(pp.playerId);
  if (pp.effects.mexen) lines.push(copy.mexen.fx.mexen);
  if (pp.effects.makesHonderdman) {
    lines.push(copy.mexen.fx.becameHonderdman(me));
  }
  if (pp.effects.drinkSips > 0) {
    lines.push(`${me} ${copy.mexen.fx.drink(pp.effects.drinkSips)}`);
  }
  if (pp.honderdmanDrinkerId) {
    lines.push(
      copy.mexen.fx.honderdmanDrinks(
        nameOf(pp.honderdmanDrinkerId),
        pp.effects.honderdmanDrinksSips,
      ),
    );
  }
  if (pp.effects.dealHalf) lines.push(`${me} ${copy.mexen.fx.dealHalf}`);
  return lines;
}

export function MexenResults({
  resolution,
  players,
  settleNote,
  isLastRound,
  onNext,
}: {
  resolution: RoundResolution;
  players: MexenPlayer[];
  settleNote: string | null;
  isLastRound: boolean;
  onNext: () => void;
}) {
  const nameOf = (id: string) =>
    players.find((p) => p.id === id)?.name ?? "—";
  const { outcome, perPlayer } = resolution;

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold">{copy.mexen.results.heading}</h3>

      <div className="space-y-1 text-sm">
        <p className="font-medium text-emerald-600 dark:text-emerald-400">
          {copy.mexen.results.winner(outcome.winnerIds.map(nameOf).join(", "))}
        </p>
        <p className="font-medium text-amber-600 dark:text-amber-400">
          {copy.mexen.results.loser(
            outcome.loserIds.map(nameOf).join(", "),
            outcome.loserAtjes,
          )}
        </p>
      </div>

      <ul className="space-y-1.5">
        {perPlayer.map((pp) => {
          const lines = effectLines(pp, nameOf);
          return (
            <li
              key={pp.playerId}
              className="flex items-center gap-3 rounded-lg border p-2 text-sm"
            >
              <span className="text-lg leading-none" aria-hidden>
                {FACE[pp.score.dice[0]]}
                {FACE[pp.score.dice[1]]}
              </span>
              <span className="w-10 font-mono font-semibold tabular-nums">
                {pp.score.isMexen ? "21" : pp.score.number}
              </span>
              <span className="flex-1 truncate">{nameOf(pp.playerId)}</span>
              {lines.length > 0 && (
                <span className="text-right text-xs text-muted-foreground">
                  {lines.join(" · ")}
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {settleNote && (
        <p className="rounded-lg bg-muted/50 p-2 text-center text-sm">
          {settleNote}
        </p>
      )}

      <Button className="w-full" onClick={onNext}>
        {isLastRound ? copy.mexen.results.finish : copy.mexen.results.nextRound}
      </Button>
    </div>
  );
}
