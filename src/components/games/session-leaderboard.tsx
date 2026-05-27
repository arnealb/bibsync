import { UserAvatar } from "@/components/user-avatar";
import type { SessionStanding } from "@/lib/games/session-queries";
import { copy } from "@/lib/copy";
import { formatRelative } from "@/lib/time";
import { cn } from "@/lib/utils";

/** Leaderboard of each member's net win/loss in their most recent gambling session. */
export function SessionLeaderboard({
  standings,
}: {
  standings: SessionStanding[];
}) {
  return (
    <section className="space-y-2">
      <h3 className="font-semibold">{copy.games.sessionBoard.title}</h3>
      <p className="text-xs text-muted-foreground">
        {copy.games.sessionBoard.subtitle}
      </p>

      {standings.length === 0 ? (
        <p className="rounded-lg border bg-card p-3 text-sm text-muted-foreground shadow-sm">
          {copy.games.sessionBoard.empty}
        </p>
      ) : (
        <ul className="divide-y rounded-lg border bg-card shadow-sm">
          {standings.map((standing, index) => (
            <li key={standing.userId} className="flex items-center gap-3 p-3">
              <span className="w-5 shrink-0 text-center text-sm font-semibold tabular-nums text-muted-foreground">
                {index + 1}
              </span>
              <UserAvatar
                name={standing.name}
                avatarUrl={standing.avatarUrl}
                className="size-7"
                fallbackClassName="text-[11px]"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{standing.name}</p>
                <p className="text-xs text-muted-foreground">
                  {copy.games.sessionBoard.meta(
                    standing.rounds,
                    formatRelative(standing.endedAt),
                  )}
                </p>
              </div>
              <span
                className={cn(
                  "font-mono text-sm font-semibold tabular-nums",
                  standing.net > 0
                    ? "text-emerald-500"
                    : standing.net < 0
                      ? "text-red-500"
                      : "text-muted-foreground",
                )}
              >
                {standing.net > 0 ? `+${standing.net}` : standing.net}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
