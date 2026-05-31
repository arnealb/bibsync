"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Flame } from "lucide-react";

import { claimQuest } from "@/app/_actions/quests";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { copy } from "@/lib/copy";
import { streakReward } from "@/lib/quests/config";
import type { QuestState } from "@/lib/quests/queries";
import { cn } from "@/lib/utils";

export function QuestBoard({
  initialQuests,
  streak,
}: {
  initialQuests: QuestState[];
  streak: number;
}) {
  const [quests, setQuests] = useState(initialQuests);
  const [pending, start] = useTransition();

  function onClaim(key: string) {
    start(async () => {
      const res = await claimQuest(key);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setQuests((prev) =>
        prev.map((q) => (q.def.key === key ? { ...q, claimed: true } : q)),
      );
      toast.success(copy.quests.claimedToast(res.granted));
    });
  }

  return (
    <Card>
      <CardContent className="space-y-3 py-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="font-semibold">{copy.quests.title}</h2>
            <p className="text-xs text-muted-foreground">
              {copy.quests.subtitle}
            </p>
          </div>
          <div className="shrink-0 rounded-lg border px-2.5 py-1 text-right">
            <p className="flex items-center gap-1 text-sm font-semibold tabular-nums">
              <Flame className="size-4 text-orange-500" />
              {streak > 0 ? copy.quests.streakDays(streak) : "0 🔥"}
            </p>
            <p className="text-[10px] text-muted-foreground tabular-nums">
              {copy.quests.streakNext(streakReward(streak + 1))}
            </p>
          </div>
        </div>

        <ul className="space-y-2">
          {quests.map(({ def, progress, claimed }) => {
            const done = progress >= def.goal;
            const pct = Math.min(100, (progress / def.goal) * 100);
            return (
              <li
                key={def.key}
                className="flex items-center gap-3 rounded-lg border p-2.5"
              >
                <span aria-hidden className="text-xl">
                  {def.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate font-medium">{def.title}</span>
                    <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
                      {copy.quests.progress(progress, def.goal)}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        done ? "bg-emerald-500" : "bg-amber-500",
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
                {claimed ? (
                  <span className="shrink-0 text-xs font-medium text-emerald-500">
                    {copy.quests.claimed}
                  </span>
                ) : (
                  <Button
                    size="sm"
                    disabled={!done || pending}
                    onClick={() => onClaim(def.key)}
                  >
                    {copy.quests.claim(def.reward)}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
