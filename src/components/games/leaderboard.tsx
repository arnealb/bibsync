"use client";

import { useState } from "react";

import { KingBadge } from "@/components/games/king-badge";
import { ProfileLink } from "@/components/profile/profile-link";
import { UserAvatar } from "@/components/user-avatar";
import { UserName } from "@/components/user-name";
import { useLeaderboardSettingsRealtime } from "@/hooks/use-leaderboard-settings-realtime";
import { copy } from "@/lib/copy";
import type { LeaderboardEntry } from "@/lib/games/queries";

interface LeaderboardProps {
  title: string;
  roomId: string;
  full: LeaderboardEntry[];
  honest: LeaderboardEntry[];
  /** Shared room setting: show all scores (true) or honest-only (false). */
  initialShowCheated: boolean;
  /** If set, the honest #1 is the daily King earning this many coins/day. */
  kingReward?: number;
  /** Crown text for the King badge; defaults to "Snake King". */
  kingLabel?: string;
}

export function Leaderboard({
  title,
  roomId,
  full,
  honest,
  initialShowCheated,
  kingReward,
  kingLabel,
}: LeaderboardProps) {
  const [showCheated, setShowCheated] = useState(initialShowCheated);
  useLeaderboardSettingsRealtime(roomId, setShowCheated);

  const entries = showCheated ? full : honest;

  return (
    <section className="rounded-lg border">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
        {!showCheated && (
          <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            {copy.games.honestView}
          </span>
        )}
      </div>
      {entries.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">
          {copy.games.noScores}
        </p>
      ) : (
        <ol className="divide-y">
          {entries.map((entry, index) => (
            <li key={entry.userId} className="flex items-center gap-3 px-4 py-2">
              <span className="w-6 text-sm font-mono tabular-nums text-muted-foreground">
                {index + 1}.
              </span>
              <ProfileLink userId={entry.userId} className="shrink-0">
                <UserAvatar
                  name={entry.name}
                  avatarUrl={entry.avatarUrl}
                  className="size-7"
                  loadout={entry.loadout}
                />
              </ProfileLink>
              <span className="flex flex-1 items-center gap-1.5 truncate text-sm">
                <ProfileLink userId={entry.userId}>
                  <UserName name={entry.name} loadout={entry.loadout} />
                </ProfileLink>
                {entry.cheated && (
                  <span
                    title={copy.games.cheatedTag}
                    aria-label={copy.games.cheatedTag}
                  >
                    🤖
                  </span>
                )}
                {kingReward != null && !showCheated && index === 0 && (
                  <KingBadge
                    reward={kingReward}
                    label={kingLabel ?? copy.games.king.snake}
                  />
                )}
              </span>
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
