"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Ticket } from "lucide-react";

import {
  buyTickets,
  drawLottery,
  drawLotteryNow,
  startLotteryRound,
  type LotteryActionResult,
} from "@/app/_actions/lottery";
import { ProfileLink } from "@/components/profile/profile-link";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { UserName } from "@/components/user-name";
import { copy } from "@/lib/copy";
import {
  LOTTERY_QUICK_BUYS,
  LOTTERY_RESULT_MS,
  LOTTERY_TICKET_PRICE,
} from "@/lib/lottery/config";
import {
  canDraw,
  ticketsFor,
  totalTickets,
  type LotteryState,
} from "@/lib/lottery/engine";
import { useLotteryRealtime } from "@/hooks/use-lottery-realtime";
import type { MemberMap } from "@/lib/members";
import { cn } from "@/lib/utils";

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

  const resolvedRound = useRef<number | null>(null);
  const startedRound = useRef<number | null>(null);

  useLotteryRealtime(roomId, setRound);

  useEffect(() => {
    const id = window.setInterval(() => setNowTs(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  const phase = round?.phase ?? "open";
  const roundNo = round?.roundNo ?? 1;
  const endsAt = round?.endsAt ? Date.parse(round.endsAt) : null;
  const secondsLeft =
    endsAt != null && nowTs > 0
      ? Math.max(0, Math.ceil((endsAt - nowTs) / 1000))
      : null;

  // When the countdown is up, any client triggers the draw (idempotent server).
  useEffect(() => {
    if (
      phase === "open" &&
      endsAt != null &&
      nowTs > 0 &&
      nowTs >= endsAt &&
      resolvedRound.current !== roundNo
    ) {
      resolvedRound.current = roundNo;
      void drawLottery(roomId);
    }
  }, [phase, endsAt, nowTs, roundNo, roomId]);

  // After showing the winner, open the next round (idempotent server-side).
  useEffect(() => {
    if (phase !== "drawn" || startedRound.current === roundNo) return;
    startedRound.current = roundNo;
    const id = window.setTimeout(() => {
      void startLotteryRound(roomId);
    }, LOTTERY_RESULT_MS);
    return () => window.clearTimeout(id);
  }, [phase, roundNo, roomId]);

  // Announce a win to the winner.
  const announced = useRef<number | null>(null);
  useEffect(() => {
    if (
      phase === "drawn" &&
      round?.winnerId === userId &&
      announced.current !== roundNo
    ) {
      announced.current = roundNo;
      toast.success(copy.lottery.youWon(round?.prize ?? 0));
    }
  }, [phase, round?.winnerId, round?.prize, roundNo, userId]);

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

  const tickets = round ? [...round.tickets].sort((a, b) => b.count - a.count) : [];
  const total = round ? totalTickets(round) : 0;
  const myTickets = round ? ticketsFor(round, userId) : 0;
  const myOdds = total > 0 ? (myTickets / total) * 100 : 0;
  const open = phase === "open";
  const drawn = phase === "drawn";

  function buy(count: number) {
    if (count * LOTTERY_TICKET_PRICE > balance) {
      toast.error(copy.lottery.cantAfford);
      return;
    }
    run(() => buyTickets({ roomId, count }));
  }

  return (
    <div className="space-y-5">
      {/* Pot */}
      <div className="rounded-xl border bg-amber-400/5 p-5 text-center">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {copy.lottery.potLabel} · {copy.lottery.round(roundNo)}
        </p>
        <p className="font-mono text-5xl font-bold tabular-nums text-amber-500">
          🎟️ {round?.pot ?? 0}
        </p>
        <p className="mt-1 text-sm font-medium">
          {drawn && round?.winnerId
            ? copy.lottery.winner(
                members[round.winnerId]?.name ?? "—",
                round.prize,
              )
            : secondsLeft != null
              ? copy.lottery.endsIn(secondsLeft)
              : open && tickets.length === 1
                ? copy.lottery.waitingPlayers
                : copy.lottery.participants(tickets.length)}
        </p>
      </div>

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
          {tickets.map((t) => {
            const won = drawn && round?.winnerId === t.userId;
            return (
              <li
                key={t.userId}
                className={cn("flex items-center gap-2 rounded-lg border p-2 text-sm", won && "border-emerald-500 bg-emerald-500/10")}
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
            );
          })}
        </ul>
      )}

      {drawn ? (
        <p className="text-center text-xs text-muted-foreground">
          {copy.lottery.nextRound}
        </p>
      ) : (
        <>
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
          {round && canDraw(round) && myTickets > 0 && secondsLeft !== 0 && (
            <Button
              className="w-full"
              disabled={pending}
              onClick={() => run(() => drawLotteryNow(roomId))}
            >
              🎲 {copy.lottery.drawNow}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
