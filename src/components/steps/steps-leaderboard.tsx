"use client";

import { useEffect, useRef, useState } from "react";

import { refreshStepsBoard } from "@/app/_actions/steps";
import { ProfileLink } from "@/components/profile/profile-link";
import { UserAvatar } from "@/components/user-avatar";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useStepsRealtime } from "@/hooks/use-steps-realtime";
import { copy } from "@/lib/copy";
import type { StepsEntry } from "@/lib/steps/queries";

const MEDALS = ["🥇", "🥈", "🥉"];

function Board({ title, entries }: { title: string; entries: StepsEntry[] }) {
  return (
    <div className="flex-1 space-y-2">
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">{copy.steps.board.empty}</p>
      ) : (
        <ul className="space-y-1.5">
          {entries.map((entry, i) => (
            <li key={entry.userId} className="flex items-center gap-2.5">
              <span className="w-5 shrink-0 text-center text-sm tabular-nums">
                {MEDALS[i] ?? i + 1}
              </span>
              <ProfileLink userId={entry.userId} className="shrink-0">
                <UserAvatar
                  name={entry.name}
                  avatarUrl={entry.avatarUrl}
                  className="size-6"
                  fallbackClassName="text-[10px]"
                />
              </ProfileLink>
              <span className="min-w-0 flex-1 truncate text-sm">
                <ProfileLink userId={entry.userId}>{entry.name}</ProfileLink>
              </span>
              <span className="shrink-0 font-mono text-sm tabular-nums">
                {copy.steps.board.unit(entry.steps)} 👟
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function StepsLeaderboard({
  roomId,
  initialToday,
  initialAllTime,
}: {
  roomId: string;
  initialToday: StepsEntry[];
  initialAllTime: StepsEntry[];
}) {
  const [board, setBoard] = useState({
    today: initialToday,
    allTime: initialAllTime,
  });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // New step sessions (health totals or browser increments) need re-aggregation
  // server-side, so we refetch — debounced, since one save fires one insert.
  useStepsRealtime(roomId, () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void refreshStepsBoard(roomId).then(setBoard);
    }, 600);
  });

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{copy.steps.board.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6 sm:flex-row">
        <Board title={copy.steps.board.today} entries={board.today} />
        <Board title={copy.steps.board.allTime} entries={board.allTime} />
      </CardContent>
    </Card>
  );
}
