import { UserAvatar } from "@/components/user-avatar";
import { copy } from "@/lib/copy";
import type { LeaderboardEntry } from "@/lib/games/queries";

interface LeaderboardProps {
  title: string;
  entries: LeaderboardEntry[];
}

export function Leaderboard({ title, entries }: LeaderboardProps) {
  return (
    <section className="rounded-lg border">
      <div className="border-b px-4 py-3">
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
      </div>
      {entries.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">
          {copy.games.noScores}
        </p>
      ) : (
        <ol className="divide-y">
          {entries.map((entry, index) => (
            <li
              key={entry.userId}
              className="flex items-center gap-3 px-4 py-2"
            >
              <span className="w-6 text-sm font-mono tabular-nums text-muted-foreground">
                {index + 1}.
              </span>
              <UserAvatar
                name={entry.name}
                avatarUrl={entry.avatarUrl}
                className="size-7"
              />
              <span className="flex-1 truncate text-sm">{entry.name}</span>
              <span className="font-mono tabular-nums text-sm font-semibold">
                {entry.bestScore}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
