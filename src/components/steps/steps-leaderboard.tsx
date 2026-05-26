"use client";

import { useState } from "react";

import { UserAvatar } from "@/components/user-avatar";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useStepsRealtime } from "@/hooks/use-steps-realtime";
import { copy } from "@/lib/copy";
import type { MemberMap } from "@/lib/members";
import type { StepsEntry } from "@/lib/steps/queries";

type Totals = Map<string, StepsEntry>;

function toMap(entries: StepsEntry[]): Totals {
  return new Map(entries.map((entry) => [entry.userId, entry]));
}

function ranked(totals: Totals): StepsEntry[] {
  return [...totals.values()].sort((a, b) => b.steps - a.steps);
}

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
              <UserAvatar
                name={entry.name}
                avatarUrl={entry.avatarUrl}
                className="size-6 shrink-0"
                fallbackClassName="text-[10px]"
              />
              <span className="min-w-0 flex-1 truncate text-sm">
                {entry.name}
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
  today,
  members,
  initialToday,
  initialAllTime,
}: {
  roomId: string;
  today: string;
  members: MemberMap;
  initialToday: StepsEntry[];
  initialAllTime: StepsEntry[];
}) {
  const [todayTotals, setTodayTotals] = useState<Totals>(() =>
    toMap(initialToday),
  );
  const [allTotals, setAllTotals] = useState<Totals>(() =>
    toMap(initialAllTime),
  );

  useStepsRealtime(roomId, (row) => {
    if (row.steps <= 0) return;
    const name = members[row.user_id]?.name ?? "—";
    const avatarUrl = members[row.user_id]?.avatarUrl ?? null;

    const add = (prev: Totals): Totals => {
      const next = new Map(prev);
      const current = next.get(row.user_id);
      next.set(row.user_id, {
        userId: row.user_id,
        name,
        avatarUrl,
        steps: (current?.steps ?? 0) + row.steps,
      });
      return next;
    };

    setAllTotals(add);
    if (row.recorded_for === today) setTodayTotals(add);
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{copy.steps.board.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6 sm:flex-row">
        <Board title={copy.steps.board.today} entries={ranked(todayTotals)} />
        <Board
          title={copy.steps.board.allTime}
          entries={ranked(allTotals)}
        />
      </CardContent>
    </Card>
  );
}
