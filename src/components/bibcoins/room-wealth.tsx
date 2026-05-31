import { Coins } from "lucide-react";

import { ProfileLink } from "@/components/profile/profile-link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserAvatar } from "@/components/user-avatar";
import type { WealthEntry } from "@/lib/bibcoins/queries";
import { copy } from "@/lib/copy";

const MEDAL = ["🥇", "🥈", "🥉"];

/** "Rijkste in de room" leaderboard — members ranked by bibcoins. */
export function RoomWealth({ entries }: { entries: WealthEntry[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Coins className="size-4 text-amber-500" />
          {copy.bibcoins.wealth.title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {copy.bibcoins.wealth.empty}
          </p>
        ) : (
          <ul className="space-y-1.5">
            {entries.map((entry, i) => (
              <li key={entry.userId} className="flex items-center gap-2 text-sm">
                <span className="w-6 shrink-0 text-center tabular-nums">
                  {MEDAL[i] ?? i + 1}
                </span>
                <ProfileLink userId={entry.userId} className="shrink-0">
                  <UserAvatar
                    name={entry.name}
                    avatarUrl={entry.avatarUrl}
                    className="size-6"
                    fallbackClassName="text-[10px]"
                  />
                </ProfileLink>
                <span className="min-w-0 flex-1 truncate">
                  <ProfileLink userId={entry.userId}>{entry.name}</ProfileLink>
                </span>
                <span className="shrink-0 font-mono font-semibold tabular-nums text-amber-500">
                  {entry.bibcoins}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
