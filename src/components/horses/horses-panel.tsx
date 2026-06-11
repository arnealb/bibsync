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
  LIVE_LINGER_MS,
  RACE_DURATION_MS,
} from "@/lib/horses/config";
import {
  horseNames,
  horsePayout,
  legacyFinishOrder,
  multLabel,
  type HorseRace,
} from "@/lib/horses/engine";
import type { HorsesState } from "@/lib/horses/queries";
import { cn } from "@/lib/utils";

const MEDALS = ["🥇", "🥈", "🥉"];

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
  const [selection, setSelection] = useState<{
    raceId: number;
    idx: number;
  } | null>(null);
  const [amount, setAmount] = useState(100);
  const [replayRace, setReplayRace] = useState<HorseRace | null>(null);
  const [dismissedLiveId, setDismissedLiveId] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const [now, setNow] = useState(() => Date.now());
  const toastedRef = useRef<number | null>(null);

  const { race, lastRace } = state;
  const selected =
    selection && race && selection.raceId === race.id ? selection.idx : null;
  const raceNames = useMemo(
    () => (race ? horseNames(race.nameSeed) : []),
    [race],
  );
  const lastNames = useMemo(
    () => (lastRace ? horseNames(lastRace.nameSeed) : []),
    [lastRace],
  );
  const replayNames = useMemo(
    () => (replayRace ? horseNames(replayRace.nameSeed) : []),
    [replayRace],
  );

  const refetch = useCallback(() => {
    startTransition(async () => {
      const res = await getHorsesView(roomId);
      if (res.ok) setState(res.state);
    });
  }, [roomId]);

  useHorsesRealtime(refetch);

  // 1s tick drives the countdown and the live-race window.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const msLeft = race ? new Date(race.runsAt).getTime() - now : 0;
  const bettingClosed = !race || msLeft <= 0;

  // The most recent resolved race is LIVE during its one-minute run (+ a
  // short linger with the winner banner); results stay hidden until then.
  const liveInfo = useMemo(() => {
    if (!lastRace) return null;
    const startMs = new Date(lastRace.runsAt).getTime();
    if (now < startMs || now >= startMs + RACE_DURATION_MS + LIVE_LINGER_MS) {
      return null;
    }
    return {
      race: lastRace,
      startMs,
      finished: now >= startMs + RACE_DURATION_MS,
    };
  }, [lastRace, now]);
  const revealed = !liveInfo || liveInfo.finished;
  const liveVisible = liveInfo !== null && dismissedLiveId !== liveInfo.race.id;

  // A due race awaiting the cron: poll as a realtime fallback.
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

  function onLiveFinished() {
    const raceId = liveInfo?.race.id;
    if (raceId === undefined || toastedRef.current === raceId) return;
    toastedRef.current = raceId;
    if (!iBetLastRace) return;
    if (myLastPayout > 0) toast.success(copy.horses.youWon(myLastPayout));
    else toast.error(copy.horses.youLost);
  }

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
      ? selectedHorse.mult2Bp > 0
        ? copy.horses.potentialPodium(
            horsePayout(amount, selectedHorse.mult1Bp),
            horsePayout(amount, selectedHorse.mult2Bp),
            horsePayout(amount, selectedHorse.mult3Bp),
          )
        : copy.horses.potential(horsePayout(amount, selectedHorse.mult1Bp))
      : null;
  const lastOrder = lastRace
    ? (lastRace.finishOrder ?? legacyFinishOrder(lastRace.winnerIdx ?? 0))
    : null;
  const winnersStrip = revealed
    ? state.recentWinners
    : state.recentWinners.filter((w) => w.raceId !== lastRace?.id);

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

      {liveVisible && liveInfo && (
        <RaceTrack
          key={`live-${liveInfo.race.id}`}
          race={liveInfo.race}
          names={lastNames}
          liveStartsAtMs={liveInfo.startMs}
          onFinished={onLiveFinished}
          onClose={() => setDismissedLiveId(liveInfo.race.id)}
        />
      )}
      {!liveVisible && replayRace && (
        <RaceTrack
          key={`replay-${replayRace.id}`}
          race={replayRace}
          names={replayNames}
          onClose={() => setReplayRace(null)}
        />
      )}

      {race ? (
        <>
          <HorseList
            horses={race.horses}
            names={raceNames}
            pools={pools}
            selected={selected}
            onSelect={(i) => setSelection({ raceId: race.id, idx: i })}
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
          <p className="text-[11px] text-muted-foreground">
            {copy.horses.multiHint}
          </p>
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

      {lastRace && lastOrder && revealed && (
        <section className="space-y-2 border-t pt-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">{copy.horses.lastRace}</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReplayRace(lastRace)}
            >
              {copy.horses.replay}
            </Button>
          </div>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="text-muted-foreground">
              {copy.horses.finishOrder}:
            </span>
            {lastOrder.slice(0, 3).map((horseIdx, pos) => (
              <span key={horseIdx} className="whitespace-nowrap">
                {MEDALS[pos]}{" "}
                <span
                  className={cn(
                    "font-semibold",
                    HORSE_COLOR_UI[lastRace.horses[horseIdx].color].text,
                  )}
                >
                  {lastNames[horseIdx]}
                </span>
                {pos === 0 && (
                  <span className="text-muted-foreground">
                    {" "}
                    ({copy.horses.odds(multLabel(lastRace.horses[horseIdx].mult1Bp))})
                  </span>
                )}
              </span>
            ))}
          </p>
          <BetsFeed
            bets={state.lastBets}
            horses={lastRace.horses}
            names={lastNames}
            myUserId={userId}
          />
          {winnersStrip.length > 1 && (
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              {copy.horses.recentWinners}:
              {winnersStrip.map((w) => (
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
