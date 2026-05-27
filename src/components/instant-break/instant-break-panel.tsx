"use client";

import { useEffect, useState, useTransition } from "react";
import { PartyPopper, Zap } from "lucide-react";
import { toast } from "sonner";

import { pushInstantBreak } from "@/app/_actions/instant-break";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useInstantBreakRealtime } from "@/hooks/use-instant-break-realtime";
import { copy } from "@/lib/copy";
import {
  DEFAULT_INSTANT_BREAK_DURATION,
  INSTANT_BREAK_DURATIONS,
  INSTANT_BREAK_THRESHOLD,
  INSTANT_BREAK_WINDOW_SECONDS,
} from "@/lib/instant-break/config";
import {
  breakEndsAt,
  breakRemainingMs,
  isBreakActive,
  recentPushers,
} from "@/lib/instant-break/status";
import type { MemberMap } from "@/lib/members";
import { formatClock } from "@/lib/time";
import type { InstantBreak, InstantBreakPush } from "@/types/database";

interface InstantBreakPanelProps {
  roomId: string;
  userId: string;
  members: MemberMap;
  initialActiveBreak: InstantBreak | null;
  initialPushes: InstantBreakPush[];
}

export function InstantBreakPanel({
  roomId,
  userId,
  members,
  initialActiveBreak,
  initialPushes,
}: InstantBreakPanelProps) {
  const [activeBreak, setActiveBreak] = useState<InstantBreak | null>(
    initialActiveBreak,
  );
  const [pushes, setPushes] = useState<InstantBreakPush[]>(initialPushes);
  const [duration, setDuration] = useState(String(DEFAULT_INSTANT_BREAK_DURATION));
  const [now, setNow] = useState(() => Date.now());
  const [pending, startPush] = useTransition();

  // Drives the countdown and ages presses out of the window.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useInstantBreakRealtime(roomId, {
    onBreak: (incoming) =>
      setActiveBreak((prev) =>
        prev && breakEndsAt(prev) >= breakEndsAt(incoming) ? prev : incoming,
      ),
    onPush: (incoming) =>
      setPushes((prev) =>
        prev.some((p) => p.id === incoming.id) ? prev : [incoming, ...prev],
      ),
  });

  const live = activeBreak && isBreakActive(activeBreak, now) ? activeBreak : null;

  if (live) {
    const remainingMin = Math.ceil(breakRemainingMs(live, now) / 60_000);
    const by = members[live.triggered_by]?.name;
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-emerald-500/50 bg-emerald-500/10 p-4">
        <PartyPopper className="size-6 shrink-0 text-emerald-600" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-emerald-700 dark:text-emerald-400">
            {copy.instantBreak.active}
          </p>
          <p className="text-sm text-muted-foreground">
            {copy.instantBreak.activeBody}
            {by && ` · ${copy.instantBreak.triggeredBy(by)}`}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium tabular-nums">
            {copy.instantBreak.until(formatClock(breakEndsAt(live)))}
          </p>
          <p className="text-xs text-muted-foreground tabular-nums">
            {copy.instantBreak.remaining(remainingMin)}
          </p>
        </div>
      </div>
    );
  }

  const pushers = recentPushers(pushes, now);
  const iPushed = pushers.has(userId);
  const count = pushers.size;
  const otherNames = [...pushers]
    .filter((id) => id !== userId)
    .map((id) => members[id]?.name)
    .filter((name): name is string => Boolean(name));

  function handlePush() {
    if (iPushed || pending) return;
    const minutes = Number(duration);
    const optimistic: InstantBreakPush = {
      id: `temp-${crypto.randomUUID()}`,
      room_id: roomId,
      user_id: userId,
      duration_minutes: minutes,
      created_at: new Date().toISOString(),
    };
    setPushes((prev) => [optimistic, ...prev]);
    startPush(async () => {
      const result = await pushInstantBreak({ roomId, durationMinutes: minutes });
      if (!result.ok) {
        setPushes((prev) => prev.filter((p) => p.id !== optimistic.id));
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3 shadow-sm">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">
          {count > 0 && otherNames.length > 0
            ? copy.instantBreak.wantsBreak(otherNames.join(", "))
            : copy.instantBreak.hint(
                INSTANT_BREAK_THRESHOLD,
                INSTANT_BREAK_WINDOW_SECONDS,
              )}
        </p>
        {count > 0 && (
          <p className="text-xs text-muted-foreground tabular-nums">
            {copy.instantBreak.waiting(count, INSTANT_BREAK_THRESHOLD)}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Select
          value={duration}
          onValueChange={(v) =>
            setDuration(v ?? String(DEFAULT_INSTANT_BREAK_DURATION))
          }
        >
          <SelectTrigger size="sm" aria-label={copy.instantBreak.durationLabel}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {INSTANT_BREAK_DURATIONS.map((min) => (
              <SelectItem key={min} value={String(min)}>
                {copy.proposals.duration(min)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          onClick={handlePush}
          disabled={iPushed || pending}
          className="gap-1.5"
        >
          <Zap className="size-4" />
          {iPushed ? copy.instantBreak.pushed : copy.instantBreak.button}
        </Button>
      </div>
    </div>
  );
}
