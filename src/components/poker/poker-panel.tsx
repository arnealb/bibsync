"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  getMyPokerHand,
  leavePokerTable,
  playPokerAction,
  sitDownPoker,
  startPokerHand,
} from "@/app/_actions/poker";
import { PlayingCard } from "@/components/poker/playing-card";
import { ProfileLink } from "@/components/profile/profile-link";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { UserName } from "@/components/user-name";
import { useAutoLeaveTable } from "@/hooks/use-auto-leave-table";
import { usePokerRealtime } from "@/hooks/use-poker-realtime";
import { copy } from "@/lib/copy";
import type { MemberMap } from "@/lib/members";
import type { Card } from "@/lib/poker/cards";
import { POKER_MIN_PLAYERS } from "@/lib/poker/config";
import {
  legalActions,
  potTotal,
  type FullState,
  type PublicState,
} from "@/lib/poker/engine";
import { cn } from "@/lib/utils";

interface PokerPanelProps {
  roomId: string;
  userId: string;
  members: MemberMap;
  initialState: PublicState | null;
  initialHand: Card[] | null;
}

export function PokerPanel({
  roomId,
  userId,
  members,
  initialState,
  initialHand,
}: PokerPanelProps) {
  const [table, setTable] = useState<PublicState | null>(initialState);
  const [myCards, setMyCards] = useState<Card[] | null>(initialHand);
  const [raiseTo, setRaiseTo] = useState(0);
  const [pending, startAction] = useTransition();

  usePokerRealtime(roomId, (state) => setTable(state));

  // Leaving the page — or sitting idle for 3 min — cashes you out so an AFK
  // player can't block the table.
  useAutoLeaveTable("poker", roomId, () => leavePokerTable(roomId), {
    armed: Boolean(table?.players.some((p) => p.userId === userId)),
  });

  const handNo = table?.handNo ?? 0;
  const status = table?.status ?? "waiting";

  // (Re)fetch our own hole cards whenever a new hand is dealt or status flips.
  useEffect(() => {
    let cancelled = false;
    getMyPokerHand(roomId).then((r) => {
      if (!cancelled && r.ok) setMyCards(r.cards);
    });
    return () => {
      cancelled = true;
    };
  }, [roomId, handNo, status]);

  const seat = table?.players.find((p) => p.userId === userId) ?? null;
  const seated = seat !== null;
  const withChips = table?.players.filter((p) => p.chips > 0).length ?? 0;
  const inHand = table?.status === "betting";
  const isMyTurn =
    inHand &&
    table?.toActIndex != null &&
    table.players[table.toActIndex]?.userId === userId;
  const legal = isMyTurn
    ? legalActions(table as unknown as FullState, userId)
    : null;

  // The slider value, clamped to the currently-legal range. Falls back to the
  // minimum raise when the user hasn't dragged it for this turn.
  const minRaise = legal?.minRaiseTo ?? 0;
  const maxRaise = legal?.maxRaiseTo ?? 0;
  const raiseValue = Math.min(Math.max(raiseTo || minRaise, minRaise), maxRaise);

  const revealed = new Map(
    (table?.result?.revealed ?? []).map((r) => [r.userId, r]),
  );

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    startAction(async () => {
      const result = await fn();
      if (!result.ok && result.error) toast.error(result.error);
    });
  }

  const canDeal =
    table != null &&
    table.status !== "betting" &&
    withChips >= POKER_MIN_PLAYERS;

  return (
    <div className="space-y-4">
      {/* Table header */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 p-3 text-sm">
        <span className="font-medium">
          {copy.poker.blinds(
            table?.smallBlind ?? 10,
            table?.bigBlind ?? 20,
          )}
          {table && table.handNo > 0 && ` · ${copy.poker.handNo(table.handNo)}`}
        </span>
        {table && (
          <span className="font-semibold tabular-nums">
            {copy.poker.pot(potTotal(table))}
          </span>
        )}
      </div>

      {/* Community cards */}
      <div className="flex min-h-16 items-center justify-center gap-1.5 rounded-lg border border-dashed bg-green-950/5 p-3">
        {table && table.community.length > 0 ? (
          table.community.map((card) => <PlayingCard key={card} card={card} />)
        ) : (
          <span className="text-xs text-muted-foreground">
            {inHand ? copy.poker.street.preflop : copy.poker.waitingToStart}
          </span>
        )}
      </div>

      {/* Showdown result */}
      {table?.status === "showdown" && table.result && (
        <div className="space-y-1 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm">
          <p className="font-semibold">{copy.poker.showdown}</p>
          {table.result.payouts.map((p) => (
            <p key={p.userId}>
              {copy.poker.wins(members[p.userId]?.name ?? "—", p.amount)}
              {(() => {
                const r = revealed.get(p.userId);
                return r ? ` · ${r.hand}` : "";
              })()}
            </p>
          ))}
        </div>
      )}

      {/* Players */}
      <div className="grid gap-2 sm:grid-cols-2">
        {(table?.players ?? []).map((p, idx) => {
          const isButton = idx === table?.buttonIndex;
          const isTurn = idx === table?.toActIndex && inHand;
          const isMe = p.userId === userId;
          const reveal = revealed.get(p.userId);
          const showCards = isMe ? myCards : (reveal?.cards ?? null);
          const inThisHand = p.status === "active" || p.status === "allin";
          return (
            <div
              key={p.userId}
              className={cn(
                "flex items-center gap-2 rounded-lg border p-2",
                isTurn && "border-primary ring-1 ring-primary",
                p.status === "folded" && "opacity-50",
              )}
            >
              <ProfileLink userId={p.userId} className="shrink-0">
                <UserAvatar
                  name={members[p.userId]?.name ?? "—"}
                  avatarUrl={members[p.userId]?.avatarUrl}
                  className="size-8"
                  fallbackClassName="text-[11px]"
                  loadout={members[p.userId]?.loadout}
                />
              </ProfileLink>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1 truncate text-sm font-medium">
                  <ProfileLink userId={p.userId}>
                    <UserName
                      name={members[p.userId]?.name ?? "—"}
                      loadout={members[p.userId]?.loadout}
                    />
                  </ProfileLink>
                  {isMe && (
                    <span className="text-muted-foreground">
                      ({copy.rooms.you})
                    </span>
                  )}
                  {isButton && (
                    <span className="rounded bg-foreground px-1 text-[10px] font-bold text-background">
                      {copy.poker.dealer}
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {copy.poker.chips(p.chips)}
                  {p.streetCommitted > 0 && ` · ${p.streetCommitted}`}
                  {p.status === "folded" && ` · ${copy.poker.foldedTag}`}
                  {p.status === "allin" && ` · ${copy.poker.allInTag}`}
                  {p.status === "out" &&
                    p.chips === 0 &&
                    ` · ${copy.poker.outTag}`}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                {inThisHand &&
                  (showCards ? (
                    showCards.map((card) => (
                      <PlayingCard key={card} card={card} size="sm" />
                    ))
                  ) : (
                    <>
                      <PlayingCard size="sm" />
                      <PlayingCard size="sm" />
                    </>
                  ))}
              </div>
            </div>
          );
        })}
      </div>

      {table && table.players.length === 0 && (
        <p className="text-center text-sm text-muted-foreground">
          {copy.poker.empty}
        </p>
      )}

      {/* Action bar */}
      <div className="space-y-3 rounded-lg border p-3">
        {!seated && (
          <div className="space-y-1">
            <Button
              className="w-full"
              disabled={pending}
              onClick={() => run(() => sitDownPoker(roomId))}
            >
              {copy.poker.sit}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              {copy.poker.buyInNote}
            </p>
          </div>
        )}

        {seated && seat.chips === 0 && !inHand && (
          <p className="text-sm text-muted-foreground">{copy.poker.busted}</p>
        )}

        {seated && !inHand && (
          <Button
            className="w-full"
            variant={canDeal ? "default" : "outline"}
            disabled={pending || !canDeal}
            onClick={() => run(() => startPokerHand(roomId))}
          >
            {copy.poker.deal}
          </Button>
        )}

        {seated && !inHand && !canDeal && withChips < POKER_MIN_PLAYERS && (
          <p className="text-center text-xs text-muted-foreground">
            {copy.poker.needPlayers(POKER_MIN_PLAYERS)}
          </p>
        )}

        {inHand && isMyTurn && legal && seat && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-primary">
              {copy.poker.yourTurn}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={pending}
                className="border-red-500/40 text-red-600 hover:bg-red-500/10 hover:text-red-600 dark:text-red-400"
                onClick={() =>
                  run(() => playPokerAction({ roomId, action: "fold" }))
                }
              >
                {copy.poker.fold}
              </Button>
              {legal.canCheck ? (
                <Button
                  disabled={pending}
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                  onClick={() =>
                    run(() => playPokerAction({ roomId, action: "check" }))
                  }
                >
                  {copy.poker.check}
                </Button>
              ) : (
                <Button
                  disabled={pending || !legal.canCall}
                  onClick={() =>
                    run(() => playPokerAction({ roomId, action: "call" }))
                  }
                >
                  {copy.poker.callAmount(legal.callAmount)}
                </Button>
              )}
              {seat.chips > 0 && (
                <Button
                  disabled={pending}
                  className="bg-amber-500 text-white hover:bg-amber-600"
                  onClick={() =>
                    run(() => playPokerAction({ roomId, action: "allin" }))
                  }
                >
                  {copy.poker.allin}
                </Button>
              )}
            </div>

            {legal.canRaise && legal.maxRaiseTo > legal.minRaiseTo && (
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={legal.minRaiseTo}
                  max={legal.maxRaiseTo}
                  step={table.bigBlind}
                  value={raiseValue}
                  onChange={(e) => setRaiseTo(Number(e.target.value))}
                  className="flex-1 accent-primary"
                  aria-label={copy.poker.amountLabel}
                />
                <Button
                  className="shrink-0 tabular-nums"
                  disabled={pending}
                  onClick={() =>
                    run(() =>
                      playPokerAction({
                        roomId,
                        action: "raise",
                        amount: raiseValue,
                      }),
                    )
                  }
                >
                  {copy.poker.raiseTo(raiseValue)}
                </Button>
              </div>
            )}
          </div>
        )}

        {inHand && !isMyTurn && table?.toActIndex != null && (
          <p className="text-center text-sm text-muted-foreground">
            {copy.poker.waitingFor(
              members[table.players[table.toActIndex].userId]?.name ?? "—",
            )}
          </p>
        )}

        {seated && (
          <div className="flex justify-center border-t pt-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              disabled={pending}
              onClick={() => run(() => leavePokerTable(roomId))}
            >
              {copy.poker.leave}
            </Button>
          </div>
        )}
        {seated && inHand && seat?.status !== "folded" && (
          <p className="text-center text-xs text-muted-foreground">
            {copy.poker.leaveMidHand}
          </p>
        )}
      </div>
    </div>
  );
}
