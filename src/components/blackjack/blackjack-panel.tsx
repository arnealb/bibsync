"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  dealBlackjack,
  doubleBlackjack,
  hitBlackjack,
  standBlackjack,
  type BlackjackResultPayload,
} from "@/app/_actions/blackjack";
import { PlayingCard } from "@/components/poker/playing-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PublicBlackjack } from "@/lib/blackjack/engine";
import { copy } from "@/lib/copy";
import { MIN_BLACKJACK_BET } from "@/lib/validation/blackjack";

interface BlackjackPanelProps {
  initialState: PublicBlackjack | null;
  initialBalance: number;
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
      router.refresh(); // keep the header balance in sync
    });
  }

  const inRound = game && game.status !== "done";
  const betting = !inRound;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {copy.bibcoins.balance(balance)}
      </p>

      {/* Table */}
      {game && (
        <div className="space-y-4 rounded-lg border p-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">
              {copy.blackjack.dealer}
              {game.dealerTotal != null && ` · ${game.dealerTotal}`}
            </p>
            <div className="flex gap-1.5">
              {game.dealer.map((card, i) => (
                <PlayingCard key={`${card}-${i}`} card={card} />
              ))}
              {game.status === "player" && <PlayingCard />}
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">
              {copy.blackjack.you} · {game.playerTotal}
              {game.playerTotal > 21 && ` · ${copy.blackjack.bust}`}
            </p>
            <div className="flex gap-1.5">
              {game.player.map((card, i) => (
                <PlayingCard key={`${card}-${i}`} card={card} />
              ))}
            </div>
          </div>

          {game.status === "done" && game.result && (
            <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-2 text-sm font-medium">
              {copy.blackjack.result[game.result]}
              {game.payout > 0 && (
                <span className="text-muted-foreground">
                  {" "}
                  · {copy.blackjack.payoutNote(game.payout)}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Controls */}
      {inRound && game.status === "player" ? (
        <div className="flex flex-wrap gap-2">
          <Button disabled={pending} onClick={() => run(hitBlackjack)}>
            {copy.blackjack.hit}
          </Button>
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => run(standBlackjack)}
          >
            {copy.blackjack.stand}
          </Button>
          {game.canDouble && balance >= game.bet && (
            <Button
              variant="secondary"
              disabled={pending}
              onClick={() => run(doubleBlackjack)}
            >
              {copy.blackjack.double}
            </Button>
          )}
        </div>
      ) : (
        betting && (
          <div className="flex items-end gap-2">
            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">
                {copy.blackjack.betLabel}
              </span>
              <Input
                type="number"
                min={MIN_BLACKJACK_BET}
                max={balance}
                step={MIN_BLACKJACK_BET}
                value={bet}
                onChange={(e) => setBet(Number(e.target.value))}
                className="w-28"
              />
            </label>
            <Button
              disabled={
                pending || bet < MIN_BLACKJACK_BET || bet > balance
              }
              onClick={() => run(() => dealBlackjack(bet))}
            >
              {game ? copy.blackjack.newRound : copy.blackjack.deal}
            </Button>
          </div>
        )
      )}
    </div>
  );
}
