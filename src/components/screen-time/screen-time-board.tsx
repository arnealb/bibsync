import { Coins } from "lucide-react";

import { ProfileLink } from "@/components/profile/profile-link";
import { UserAvatar } from "@/components/user-avatar";
import { UserName } from "@/components/user-name";
import { copy } from "@/lib/copy";
import type { MemberScreenTime } from "@/lib/screen-time/aggregate";
import { formatScreenTime } from "@/lib/screen-time/format";

const MEDALS = ["🥇", "🥈", "🥉"];

/**
 * Ranked screen-time leaderboard: each member with a relative bar, their total
 * screen time, today's slice and the bibcoins they earned from it. Server
 * component — purely presentational.
 */
export function ScreenTimeBoard({
  members,
  currentUserId,
}: {
  members: MemberScreenTime[];
  currentUserId: string;
}) {
  if (members.every((m) => m.totalSeconds === 0)) {
    return (
      <p className="text-sm text-muted-foreground">{copy.screenTime.empty}</p>
    );
  }

  const max = Math.max(1, ...members.map((m) => m.totalSeconds));

  return (
    <ul className="space-y-3">
      {members.map((m, i) => {
        const pct = (m.totalSeconds / max) * 100;
        const isMe = m.userId === currentUserId;
        return (
          <li key={m.userId} className="flex items-center gap-3">
            <span className="w-5 shrink-0 text-center text-sm tabular-nums">
              {MEDALS[i] ?? i + 1}
            </span>
            <ProfileLink userId={m.userId} className="shrink-0">
              <UserAvatar
                name={m.name}
                avatarUrl={m.avatarUrl}
                className="size-8"
                fallbackClassName="text-xs"
                loadout={m.loadout}
              />
            </ProfileLink>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate text-sm font-medium">
                  <ProfileLink userId={m.userId}>
                    <UserName name={m.name} loadout={m.loadout} />
                  </ProfileLink>
                  {isMe && (
                    <span className="ml-1 text-xs text-muted-foreground">
                      {copy.screenTime.you}
                    </span>
                  )}
                </span>
                <span className="shrink-0 font-mono text-sm tabular-nums">
                  {formatScreenTime(m.totalSeconds)}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500"
                  style={{ width: `${Math.max(pct, m.totalSeconds > 0 ? 3 : 0)}%` }}
                />
              </div>
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Coins className="size-3.5 text-amber-500" />
                  <span className="tabular-nums">{m.totalCoins}</span>
                  {copy.screenTime.coinsLabel}
                </span>
                {m.todaySeconds > 0 && (
                  <span className="tabular-nums">
                    {copy.screenTime.todaySuffix(
                      formatScreenTime(m.todaySeconds),
                    )}
                  </span>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
