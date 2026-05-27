"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  dealBlackjack,
  joinBlackjack,
  leaveBlackjack,
  placeBlackjackBet,
  playBlackjack,
  startBlackjackRound,
  type BlackjackActionResult,
} from "@/app/_actions/blackjack";
import { PlayingCard } from "@/components/poker/playing-card";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useBlackjackRealtime } from "@/hooks/use-blackjack-realtime";
import { cardScore } from "@/lib/blackjack/engine";
import type { PublicHand, PublicSeat, PublicTable } from "@/lib/blackjack/table";
import { copy } from "@/lib/copy";
import type { MemberMap } from "@/lib/members";
import type { Card } from "@/lib/poker/cards";
import { cn } from "@/lib/utils";
import { MIN_BLACKJACK_BET } from "@/lib/validation/blackjack";

interface BlackjackPanelProps {
  roomId: string;
  userId: string;
  members: MemberMap;
  initialState: PublicTable | null;
  initialBalance: number;
}

const RESULT_STYLE: Record<string, string> = {
  win: "bg-emerald-600 text-white",
  blackjack: "bg-amber-500 text-white",
  push: "bg-muted text-muted-foreground",
  lose: "bg-red-600/90 text-white",
};

function CardFan({ cards, hidden }: { cards: Card[]; hidden?: boolean }) {
  return (
    <div className="flex">
      {cards.map((card, i) => (
        <div key={`${card}-${i}`} className={i > 0 ? "-ml-3.5" : ""}>
          <PlayingCard card={card} size="sm" />
        </div>
      ))}
      {hidden && (
        <div className="-ml-3.5">
          <PlayingCard size="sm" />
        </div>
      )}
    </div>
  );
}

function TotalBadge({ total, bust }: { total: number | null; bust?: boolean }) {
  return (
    <span
      className={cn(
        "rounded-full border bg-background/80 px-2 py-0.5 text-xs font-bold tabular-nums shadow-sm",
        bust && "border-red-500/50 text-red-500",
      )}
    >
      {total ?? "?"}
    </span>
  );
}

function HandView({ hand, showLabel }: { hand: PublicHand; showLabel?: number }) {
  return (
    <div className="flex flex-col items-center gap-1">
      {showLabel != null && (
        <span className="text-[10px] text-muted-foreground">
          {copy.blackjack.handLabel(showLabel)}
        </span>
      )}
      <TotalBadge total={hand.total} bust={hand.total > 21} />
      <CardFan cards={hand.cards} />
      {hand.result && (
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
            RESULT_STYLE[hand.result],
          )}
        >
          {copy.blackjack.result[hand.result]}
        </span>
      )}
    </div>
  );
}

function SeatView({
  seat,
  members,
  isYou,
  isActive,
}: {
  seat: PublicSeat;
  members: MemberMap;
  isYou: boolean;
  isActive: boolean;
}) {
  const name = members[seat.userId]?.name ?? "—";
  return (
    <div
      className={cn(
        "flex min-w-28 flex-col items-center gap-1.5 rounded-lg border p-2 transition",
        isActive && "bg-emerald-500/10 ring-1 ring-emerald-500/50",
      )}
    >
      <div className="flex items-center gap-1.5">
        <UserAvatar
          name={name}
          avatarUrl={members[seat.userId]?.avatarUrl}
          className="size-5"
          fallbackClassName="text-[9px]"
        />
        <span className="max-w-20 truncate text-xs font-medium">
          {isYou ? copy.blackjack.you : name}
        </span>
      </div>
      {seat.bet > 0 && (
        <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600 tabular-nums dark:text-amber-500">
          {copy.blackjack.betChip(seat.bet)}
        </span>
      )}
      {seat.hands.length > 0 && (
        <div className="flex gap-2">
          {seat.hands.map((hand, i) => (
            <HandView
              key={i}
              hand={hand}
              showLabel={seat.hands.length > 1 ? i + 1 : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function BlackjackPanel({
  roomId,
  userId,
  members,
  initialState,
  initialBalance,
}: BlackjackPanelProps) {
  const router = useRouter();
  const [table, setTable] = useState<PublicTable | null>(initialState);
  const [balance, setBalance] = useState(initialBalance);
  const [bet, setBet] = useState(() =>
    Math.max(MIN_BLACKJACK_BET, Math.min(100, initialBalance)),
  );
  const [pending, start] = useTransition();
  const lastPhase = useRef(initialState?.phase);

  useBlackjackRealtime(roomId, setTable);

  // When a round resolves, refresh server-rendered balance (payouts may have
  // landed via someone else's final move).
  useEffect(() => {
    if (table?.phase === "done" && lastPhase.current !== "done") {
      router.refresh();
    }
    lastPhase.current = table?.phase;
  }, [table?.phase, router]);

  function run(fn: () => Promise<BlackjackActionResult>) {
    start(async () => {
      const result = await fn();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (typeof result.balance === "number") setBalance(result.balance);
    });
  }

  const seats = table?.seats ?? [];
  const mySeat = seats.find((s) => s.userId === userId) ?? null;
  const seated = Boolean(mySeat);
  const phase = table?.phase ?? "betting";
  const isMyTurn =
    phase === "player" &&
    table?.toActIndex != null &&
    seats[table.toActIndex]?.userId === userId;
  const activeHand = isMyTurn ? mySeat!.hands[mySeat!.activeHand] : null;

  const fresh = Boolean(activeHand && activeHand.cards.length === 2 && !activeHand.doubled);
  const canDouble = fresh && balance >= (activeHand?.bet ?? 0);
  const canSplit =
    isMyTurn &&
    mySeat!.hands.length === 1 &&
    activeHand?.cards.length === 2 &&
    cardScore(activeHand.cards[0]!) === cardScore(activeHand.cards[1]!) &&
    balance >= mySeat!.hands[0]!.bet;

  const clampBet = (v: number) =>
    Math.max(MIN_BLACKJACK_BET, Math.min(balance, Math.round(v)));
  const myBet = mySeat?.bet ?? 0;
  const tableHasBets = seats.some((s) => s.bet > 0);
  const activeName =
    table?.toActIndex != null
      ? (members[seats[table.toActIndex]?.userId ?? ""]?.name ?? "—")
      : "—";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {copy.blackjack.seatedCount(seats.length)}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() =>
            run(seated ? () => leaveBlackjack(roomId) : () => joinBlackjack(roomId))
          }
        >
          {seated ? copy.blackjack.leave : copy.blackjack.join}
        </Button>
      </div>

      {/* Felt */}
      <div className="space-y-5 rounded-xl border bg-gradient-to-b from-emerald-900/20 to-muted/20 p-4 sm:p-6">
        <div className="flex flex-col items-center gap-1.5">
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {copy.blackjack.dealer}
          </span>
          {table && table.dealer.length > 0 ? (
            <>
              <TotalBadge
                total={table.dealerTotal}
                bust={(table.dealerTotal ?? 0) > 21}
              />
              <CardFan cards={table.dealer} hidden={phase === "player"} />
            </>
          ) : (
            <div className="flex">
              <PlayingCard size="sm" />
              <div className="-ml-3.5">
                <PlayingCard size="sm" />
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-dashed border-border/50" />

        <div className="flex flex-wrap items-start justify-center gap-3">
          {seats.length > 0 ? (
            seats.map((seat, i) => (
              <SeatView
                key={seat.userId}
                seat={seat}
                members={members}
                isYou={seat.userId === userId}
                isActive={phase === "player" && table?.toActIndex === i}
              />
            ))
          ) : (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {copy.blackjack.empty}
            </p>
          )}
        </div>
      </div>

      {/* Controls */}
      {!seated ? (
        <p className="text-center text-sm text-muted-foreground">
          {copy.blackjack.sitFirst}
        </p>
      ) : phase === "player" ? (
        isMyTurn ? (
          <div className="grid grid-cols-2 gap-2">
            <Button
              disabled={pending}
              onClick={() => run(() => playBlackjack({ roomId, action: "hit" }))}
            >
              {copy.blackjack.hit}
            </Button>
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => run(() => playBlackjack({ roomId, action: "stand" }))}
            >
              {copy.blackjack.stand}
            </Button>
            <Button
              variant="secondary"
              disabled={pending || !canSplit}
              onClick={() => run(() => playBlackjack({ roomId, action: "split" }))}
            >
              {copy.blackjack.split}
            </Button>
            <Button
              variant="secondary"
              disabled={pending || !canDouble}
              onClick={() => run(() => playBlackjack({ roomId, action: "double" }))}
            >
              {copy.blackjack.double}
            </Button>
          </div>
        ) : (
          <p className="text-center text-sm font-medium text-muted-foreground">
            {copy.blackjack.waitingFor(activeName)}
          </p>
        )
      ) : phase === "done" ? (
        <div className="space-y-2">
          {mySeat && (
            <p className="text-center text-sm font-medium">
              {mySeat.hands.reduce((s, h) => s + h.payout, 0) > 0
                ? copy.blackjack.payoutNote(
                    mySeat.hands.reduce((s, h) => s + h.payout, 0),
                  )
                : copy.blackjack.result.lose}
            </p>
          )}
          <Button
            className="w-full"
            disabled={pending}
            onClick={() => run(() => startBlackjackRound(roomId))}
          >
            {copy.blackjack.newRound}
          </Button>
        </div>
      ) : (
        // betting
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {copy.blackjack.bettingOpen}
            </span>
            <span className="font-mono tabular-nums text-muted-foreground">
              {copy.bibcoins.balance(balance)}
            </span>
          </div>

          {myBet > 0 ? (
            <p className="text-center text-sm">
              {copy.blackjack.betChip(myBet)} ✓
            </p>
          ) : (
            <div className="flex gap-2">
              <Input
                type="number"
                min={MIN_BLACKJACK_BET}
                max={balance}
                step={MIN_BLACKJACK_BET}
                value={bet}
                onChange={(e) => setBet(Number(e.target.value))}
                className="flex-1 font-mono tabular-nums"
              />
              <Button
                disabled={pending || bet < MIN_BLACKJACK_BET || bet > balance}
                onClick={() =>
                  run(() => placeBlackjackBet({ roomId, amount: clampBet(bet) }))
                }
              >
                {copy.blackjack.placeBet}
              </Button>
            </div>
          )}

          <Button
            className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
            disabled={pending || !tableHasBets}
            onClick={() => run(() => dealBlackjack(roomId))}
          >
            {copy.blackjack.deal}
          </Button>
        </div>
      )}
    </div>
  );
}
