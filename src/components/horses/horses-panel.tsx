"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";

import { getHorsesView, placeHorseBet } from "@/app/_actions/horses";
import { BetForm } from "@/components/horses/bet-form";
import { BetsFeed } from "@/components/horses/bets-feed";
import { HORSE_COLOR_UI } from "@/components/horses/colors";
import { HorseList } from "@/components/horses/horse-list";
import { RaceTrack } from "@/components/horses/race-track";
import { Button } from "@/components/ui/button";
import { useHorsesRealtime } from "@/hooks/use-horses-realtime";
import { copy } from "@/lib/copy";
import {
  HORSE_COUNT,
  HORSES_MAX_BET,
  HORSES_MIN_BET,
} from "@/lib/horses/config";
import {
  horseNames,
  horsePayout,
  multLabel,
  type HorseRace,
} from "@/lib/horses/engine";
import type { HorsesState } from "@/lib/horses/queries";
import { cn } from "@/lib/utils";

export function HorsesPanel({
  roomId,
  userId,
  initial,
}: {
  roomId: string;
  userId: string;
  initial: HorsesState;
}) {
  const [state, setState] = useState(initial);
  const [selected, setSelected] = useState<number | null>(null);
  const [amount, setAmount] = useState(100);
  const [replay, setReplay] = useState<{ race: HorseRace; live: boolean } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();
  const [now, setNow] = useState(() => Date.now());

  const { race, lastRace } = state;
  const raceNames = useMemo(
    () => (race ? horseNames(race.nameSeed) : []),
    [race],
  );
  const lastNames = useMemo(
    () => (lastRace ? horseNames(lastRace.nameSeed) : []),
    [lastRace],
  );
  const replayNames = useMemo(
    () => (replay ? horseNames(replay.race.nameSeed) : []),
    [replay],
  );

  const refetch = useCallback(() => {
    startTransition(async () => {
      const res = await getHorsesView(roomId);
      if (res.ok) setState(res.state);
    });
  }, [roomId]);

  useHorsesRealtime(refetch);

  // The race we were betting on just resolved → play the replay live.
  const prevOpenRef = useRef<number | null>(initial.race?.id ?? null);
  useEffect(() => {
    if (lastRace && prevOpenRef.current === lastRace.id) {
      setReplay({ race: lastRace, live: true });
      setSelected(null);
    }
    prevOpenRef.current = race?.id ?? null;
  }, [race, lastRace]);

  // 1s countdown tick; refetch fallback while a due race awaits the cron.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const msLeft = race ? new Date(race.runsAt).getTime() - now : 0;
  const bettingClosed = !race || msLeft <= 0;
  const awaitingResult = race !== null && msLeft <= 0;
  useEffect(() => {
    if (!awaitingResult) return;
    const id = setInterval(refetch, 5000);
    return () => clearInterval(id);
  }, [awaitingResult, refetch]);

  const pools = useMemo(() => {
    const sums = Array.from({ length: HORSE_COUNT }, () => 0);
    for (const b of state.raceBets) {
      if (b.horseIdx >= 0 && b.horseIdx < HORSE_COUNT) {
        sums[b.horseIdx] += b.amount;
      }
    }
    return sums;
  }, [state.raceBets]);

  const myLastPayout = state.lastBets
    .filter((b) => b.userId === userId)
    .reduce((sum, b) => sum + (b.payout ?? 0), 0);
  const iBetLastRace = state.lastBets.some((b) => b.userId === userId);

  function submit() {
    if (!race || selected === null) {
      toast.error(copy.horses.pickHorse);
      return;
    }
    if (
      amount < HORSES_MIN_BET ||
      amount > HORSES_MAX_BET ||
      amount > state.balance
    ) {
      toast.error(copy.horses.cantAfford);
      return;
    }
    const input = { roomId, raceId: race.id, horseIdx: selected, amount };
    const name = raceNames[selected];
    startTransition(async () => {
      const res = await placeHorseBet(input);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(copy.horses.betPlaced(name));
      setState((prev) => ({ ...prev, balance: res.balance }));
      refetch();
    });
  }

  const minutes = Math.max(0, Math.floor(msLeft / 60_000));
  const seconds = Math.max(0, Math.floor((msLeft % 60_000) / 1000));
  const selectedHorse =
    selected !== null && race ? race.horses[selected] : null;
  const potentialText =
    selectedHorse && amount > 0
      ? `${raceNames[selected as number]} ${copy.horses.potential(
          horsePayout(amount, selectedHorse.multBp),
        )}`
      : null;
  const lastWinner =
    lastRace && lastRace.winnerIdx !== null
      ? lastRace.horses[lastRace.winnerIdx]
      : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="font-mono tabular-nums text-muted-foreground">
          {copy.bibcoins.balance(state.balance)}
        </span>
        {race &&
          (bettingClosed ? (
            <span className="font-medium text-amber-500">
              {copy.horses.startingSoon}
            </span>
          ) : (
            <span className="font-mono tabular-nums">
              {copy.horses.countdown(minutes, seconds)}
            </span>
          ))}
      </div>

      {replay && (
        <RaceTrack
          key={replay.race.id}
          race={replay.race}
          names={replayNames}
          onFinished={
            replay.live && iBetLastRace
              ? () => {
                  if (myLastPayout > 0) {
                    toast.success(copy.horses.youWon(myLastPayout));
                  } else {
                    toast.error(copy.horses.youLost);
                  }
                }
              : undefined
          }
          onClose={() => setReplay(null)}
        />
      )}

      {race ? (
        <>
          <HorseList
            horses={race.horses}
            names={raceNames}
            pools={pools}
            selected={selected}
            onSelect={(i) => setSelected(i)}
            disabled={bettingClosed}
          />
          <BetForm
            amount={amount}
            onAmountChange={setAmount}
            onSubmit={submit}
            pending={pending}
            disabled={bettingClosed || selected === null}
            potentialText={potentialText}
          />
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">{copy.horses.betsTitle}</h3>
            <BetsFeed
              bets={state.raceBets}
              horses={race.horses}
              names={raceNames}
              myUserId={userId}
            />
          </section>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">{copy.horses.noRace}</p>
      )}

      {lastRace && lastWinner && (
        <section className="space-y-2 border-t pt-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">{copy.horses.lastRace}</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReplay({ race: lastRace, live: false })}
            >
              {copy.horses.replay}
            </Button>
          </div>
          <p className="text-sm">
            🏆{" "}
            <span
              className={cn("font-semibold", HORSE_COLOR_UI[lastWinner.color].text)}
            >
              {lastNames[lastRace.winnerIdx as number]}
            </span>{" "}
            <span className="text-muted-foreground">
              ({copy.horses.colors[lastWinner.color]} ·{" "}
              {copy.horses.odds(multLabel(lastWinner.multBp))})
            </span>
          </p>
          <BetsFeed
            bets={state.lastBets}
            horses={lastRace.horses}
            names={lastNames}
            myUserId={userId}
          />
          {state.recentWinners.length > 1 && (
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              {copy.horses.recentWinners}:
              {state.recentWinners.map((w) => (
                <span
                  key={w.raceId}
                  className={cn(
                    "size-2.5 rounded-full",
                    HORSE_COLOR_UI[w.color].dot,
                  )}
                />
              ))}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
