"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Clock, Ticket } from "lucide-react";

import {
  buyTickets,
  type LotteryActionResult,
} from "@/app/_actions/lottery";
import { ProfileLink } from "@/components/profile/profile-link";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { UserName } from "@/components/user-name";
import { copy } from "@/lib/copy";
import {
  LOTTERY_DRAW_HOUR,
  LOTTERY_QUICK_BUYS,
  LOTTERY_TICKET_PRICE,
} from "@/lib/lottery/config";
import {
  ticketsFor,
  totalTickets,
  type LotteryState,
} from "@/lib/lottery/engine";
import { useLotteryRealtime } from "@/hooks/use-lottery-realtime";
import type { MemberMap } from "@/lib/members";

/** Next daily-draw instant (local 22:00, which is Brussels for our users). */
function nextDraw(now: number): number {
  const d = new Date(now);
  d.setHours(LOTTERY_DRAW_HOUR, 0, 0, 0);
  if (d.getTime() <= now) d.setDate(d.getDate() + 1);
  return d.getTime();
}

export function LotteryPanel({
  roomId,
  userId,
  members,
  initialState,
  initialBalance,
}: {
  roomId: string;
  userId: string;
  members: MemberMap;
  initialState: LotteryState | null;
  initialBalance: number;
}) {
  const [round, setRound] = useState<LotteryState | null>(initialState);
  const [balance, setBalance] = useState(initialBalance);
  const [nowTs, setNowTs] = useState(0);
  const [pending, start] = useTransition();
  const lastRoundNo = useRef(initialState?.roundNo ?? 0);

  useLotteryRealtime(roomId, (state) => {
    // A new round (higher roundNo) means the draw just happened.
    if (
      state.roundNo > lastRoundNo.current &&
      state.lastWinnerId === userId &&
      state.lastPrize > 0
    ) {
      toast.success(copy.lottery.youWon(state.lastPrize));
    }
    lastRoundNo.current = state.roundNo;
    setRound(state);
  });

  useEffect(() => {
    const id = window.setInterval(() => setNowTs(Date.now()), 500);
    return () => window.clearInterval(id);
  }, []);

  const tickets = round ? [...round.tickets].sort((a, b) => b.count - a.count) : [];
  const total = round ? totalTickets(round) : 0;
  const myTickets = round ? ticketsFor(round, userId) : 0;
  const myOdds = total > 0 ? (myTickets / total) * 100 : 0;

  const msLeft = nowTs > 0 ? Math.max(0, nextDraw(nowTs) - nowTs) : 0;
  const hh = Math.floor(msLeft / 3_600_000);
  const mm = Math.floor((msLeft % 3_600_000) / 60_000);
  const ss = Math.floor((msLeft % 60_000) / 1000);

  function run(fn: () => Promise<LotteryActionResult>) {
    start(async () => {
      const result = await fn();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (typeof result.balance === "number") setBalance(result.balance);
    });
  }

  function buy(count: number) {
    if (count * LOTTERY_TICKET_PRICE > balance) {
      toast.error(copy.lottery.cantAfford);
      return;
    }
    run(() => buyTickets({ roomId, count }));
  }

  return (
    <div className="space-y-5">
      {/* Pot + countdown */}
      <div className="rounded-xl border bg-amber-400/5 p-5 text-center">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {copy.lottery.potLabel} · {copy.lottery.round(round?.roundNo ?? 1)}
        </p>
        <p className="font-mono text-5xl font-bold tabular-nums text-amber-500">
          🎟️ {round?.pot ?? 0}
        </p>
        <p className="mt-1 flex items-center justify-center gap-1.5 text-sm font-medium">
          <Clock className="size-4 text-muted-foreground" />
          {nowTs > 0
            ? copy.lottery.drawIn(hh, mm, ss)
            : copy.lottery.drawAt}
        </p>
      </div>

      {/* Last winner */}
      {round?.lastWinnerId && round.lastPrize > 0 && (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-center text-sm font-medium text-emerald-600 dark:text-emerald-400">
          {copy.lottery.lastWinner(
            members[round.lastWinnerId]?.name ?? "—",
            round.lastPrize,
          )}
        </p>
      )}

      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="font-mono tabular-nums text-muted-foreground">
          {copy.bibcoins.balance(balance)}
        </span>
        {myTickets > 0 && (
          <span className="font-medium">
            {copy.lottery.yourTickets(myTickets)} · {copy.lottery.yourOdds(myOdds)}
          </span>
        )}
      </div>

      {/* Participants */}
      {tickets.length === 0 ? (
        <p className="py-2 text-center text-sm text-muted-foreground">
          {copy.lottery.noTickets}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {tickets.map((t) => (
            <li
              key={t.userId}
              className="flex items-center gap-2 rounded-lg border p-2 text-sm"
            >
              <ProfileLink userId={t.userId} className="shrink-0">
                <UserAvatar
                  name={members[t.userId]?.name ?? "—"}
                  avatarUrl={members[t.userId]?.avatarUrl}
                  className="size-6"
                  fallbackClassName="text-[10px]"
                  loadout={members[t.userId]?.loadout}
                />
              </ProfileLink>
              <span className="min-w-0 flex-1 truncate">
                <ProfileLink userId={t.userId}>
                  <UserName
                    name={members[t.userId]?.name ?? "—"}
                    loadout={members[t.userId]?.loadout}
                  />
                </ProfileLink>
              </span>
              <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
                {t.count} ({total > 0 ? Math.round((t.count / total) * 100) : 0}%)
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* Buy */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">
          {copy.lottery.ticketPrice(LOTTERY_TICKET_PRICE)}
        </span>
        {LOTTERY_QUICK_BUYS.map((c) => (
          <Button
            key={c}
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => buy(c)}
          >
            <Ticket className="size-4" />
            {copy.lottery.buy(c)}
          </Button>
        ))}
      </div>
    </div>
  );
}
