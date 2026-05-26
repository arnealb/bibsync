"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  dealBlackjack,
  doubleBlackjack,
  hitBlackjack,
  splitBlackjack,
  standBlackjack,
  type BlackjackResultPayload,
} from "@/app/_actions/blackjack";
import { PlayingCard } from "@/components/poker/playing-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PublicBlackjack, PublicHand } from "@/lib/blackjack/engine";
import type { Card } from "@/lib/poker/cards";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { MIN_BLACKJACK_BET } from "@/lib/validation/blackjack";

interface BlackjackPanelProps {
  initialState: PublicBlackjack | null;
  initialBalance: number;
}

function CardFan({ cards, hidden }: { cards: Card[]; hidden?: boolean }) {
  return (
    <div className="flex">
      {cards.map((card, i) => (
        <div key={`${card}-${i}`} className={i > 0 ? "-ml-4" : ""}>
          <PlayingCard card={card} />
        </div>
      ))}
      {hidden && (
        <div className="-ml-4">
          <PlayingCard />
        </div>
      )}
    </div>
  );
}

function TotalBadge({
  total,
  bust,
}: {
  total: number | null;
  bust?: boolean;
}) {
  return (
    <span
      className={cn(
        "rounded-full border bg-background/80 px-2.5 py-0.5 text-sm font-bold tabular-nums shadow-sm",
        bust && "border-red-500/50 text-red-500",
      )}
    >
      {total ?? "?"}
    </span>
  );
}

const RESULT_STYLE: Record<string, string> = {
  win: "bg-emerald-600 text-white",
  blackjack: "bg-amber-500 text-white",
  push: "bg-muted text-muted-foreground",
  lose: "bg-red-600/90 text-white",
};

function PlayerHand({ hand }: { hand: PublicHand }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-1.5 rounded-lg p-2 transition",
        hand.active && "bg-emerald-500/10 ring-1 ring-emerald-500/50",
      )}
    >
      <TotalBadge total={hand.total} bust={hand.total > 21} />
      <CardFan cards={hand.cards} />
      {hand.result && (
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-xs font-semibold",
            RESULT_STYLE[hand.result],
          )}
        >
          {copy.blackjack.result[hand.result]}
        </span>
      )}
    </div>
  );
}

export function BlackjackPanel({
  initialState,
  initialBalance,
}: BlackjackPanelProps) {
  const router = useRouter();
  const [game, setGame] = useState(initialState);
  const [balance, setBalance] = useState(initialBalance);
  const [bet, setBet] = useState(() =>
    Math.max(MIN_BLACKJACK_BET, Math.min(100, initialBalance)),
  );
  const [pending, start] = useTransition();

  function run(action: () => Promise<BlackjackResultPayload>) {
    start(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setGame(result.state);
      setBalance(result.balance);
      router.refresh();
    });
  }

  const playing = game?.status === "player";
  const betting = !game || game.status === "done";
  const clampBet = (v: number) =>
    Math.max(MIN_BLACKJACK_BET, Math.min(balance, Math.round(v)));

  return (
    <div className="space-y-4">
      {/* Felt table */}
      <div className="space-y-6 rounded-xl border bg-gradient-to-b from-emerald-900/20 to-muted/20 p-4 sm:p-6">
        <div className="flex flex-col items-center gap-1.5">
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {copy.blackjack.dealer}
          </span>
          {game ? (
            <>
              <TotalBadge
                total={game.dealerTotal}
                bust={(game.dealerTotal ?? 0) > 21}
              />
              <CardFan cards={game.dealer} hidden={game.status === "player"} />
            </>
          ) : (
            <div className="flex">
              <PlayingCard />
              <div className="-ml-4">
                <PlayingCard />
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-dashed border-border/50" />

        <div className="flex flex-wrap items-start justify-center gap-4">
          {game ? (
            game.hands.map((hand, i) => <PlayerHand key={i} hand={hand} />)
          ) : (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {copy.blackjack.subtitle}
            </p>
          )}
        </div>

        {game?.status === "done" && (
          <p className="text-center text-sm font-medium">
            {game.totalPayout > 0
              ? copy.blackjack.payoutNote(game.totalPayout)
              : copy.blackjack.result.lose}
          </p>
        )}
      </div>

      {/* Controls */}
      {playing ? (
        <div className="grid grid-cols-2 gap-2">
          <Button
            disabled={!game.canHit || pending}
            onClick={() => run(hitBlackjack)}
          >
            {copy.blackjack.hit}
          </Button>
          <Button
            variant="outline"
            disabled={!game.canStand || pending}
            onClick={() => run(standBlackjack)}
          >
            {copy.blackjack.stand}
          </Button>
          <Button
            variant="secondary"
            disabled={!game.canSplit || balance < game.baseBet || pending}
            onClick={() => run(splitBlackjack)}
          >
            {copy.blackjack.split}
          </Button>
          <Button
            variant="secondary"
            disabled={!game.canDouble || balance < game.baseBet || pending}
            onClick={() => run(doubleBlackjack)}
          >
            {copy.blackjack.double}
          </Button>
        </div>
      ) : (
        betting && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {copy.blackjack.betLabel}
              </span>
              <span className="font-mono tabular-nums text-muted-foreground">
                {copy.bibcoins.balance(balance)}
              </span>
            </div>
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
                variant="outline"
                disabled={pending}
                onClick={() => setBet((b) => clampBet(b / 2))}
              >
                ½
              </Button>
              <Button
                variant="outline"
                disabled={pending}
                onClick={() => setBet((b) => clampBet(b * 2))}
              >
                2×
              </Button>
            </div>
            <Button
              className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
              disabled={pending || bet < MIN_BLACKJACK_BET || bet > balance}
              onClick={() => run(() => dealBlackjack(clampBet(bet)))}
            >
              {game ? copy.blackjack.newRound : copy.blackjack.deal}
            </Button>
          </div>
        )
      )}
    </div>
  );
}
