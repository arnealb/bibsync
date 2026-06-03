"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { settleMexenRound } from "@/app/_actions/mexen";
import { MexenResults } from "@/components/mexen/mexen-results";
import { MexenRound } from "@/components/mexen/mexen-round";
import { MexenSetup } from "@/components/mexen/mexen-setup";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { copy } from "@/lib/copy";
import {
  reorderLoserFirst,
  resolveRound,
  type MexenConfig,
  type MexenFinal,
  type MexenPlayer,
  type RoundResolution,
} from "@/lib/mexen/game";

type Phase = "setup" | "playing" | "results" | "done";

interface Tally {
  losses: number;
  net: number;
}

export function MexenPanel({ roomId, members }: { roomId: string; members: MexenPlayer[] }) {
  const [phase, setPhase] = useState<Phase>("setup");
  const [config, setConfig] = useState<MexenConfig | null>(null);
  const [order, setOrder] = useState<MexenPlayer[]>([]);
  const [roundNo, setRoundNo] = useState(1);
  const [honderdmanId, setHonderdmanId] = useState<string | null>(null);
  const [resolution, setResolution] = useState<RoundResolution | null>(null);
  const [settleNote, setSettleNote] = useState<string | null>(null);
  const [tallies, setTallies] = useState<Record<string, Tally>>({});
  const [, startSettle] = useTransition();

  const nameOf = (id: string) => order.find((p) => p.id === id)?.name ?? "—";

  function handleStart(cfg: MexenConfig) {
    setConfig(cfg);
    setOrder(cfg.players);
    setRoundNo(1);
    setHonderdmanId(null);
    setTallies(
      Object.fromEntries(cfg.players.map((p) => [p.id, { losses: 0, net: 0 }])),
    );
    setPhase("playing");
  }

  function handleRoundComplete(finals: MexenFinal[]) {
    if (!config) return;
    const res = resolveRound(finals, honderdmanId);
    setHonderdmanId(res.honderdmanId);
    setResolution(res);
    setSettleNote(null);

    // Tally losses (all tied losers count).
    setTallies((prev) => {
      const next = { ...prev };
      for (const id of res.outcome.loserIds) {
        next[id] = { ...next[id], losses: next[id].losses + 1 };
      }
      return next;
    });

    // Settle the stake when betting and there is exactly one loser and winner.
    const loser = res.outcome.loserIds;
    const winner = res.outcome.winnerIds;
    if (
      config.betting &&
      loser.length === 1 &&
      winner.length === 1 &&
      loser[0] !== winner[0]
    ) {
      const loserId = loser[0];
      const winnerId = winner[0];
      const stake = config.stake;
      const ref = `${roundNo}:${loserId}:${winnerId}`;
      startSettle(async () => {
        const out = await settleMexenRound({ roomId, loserId, winnerId, stake, ref });
        if (!out.ok) {
          toast.error(out.error);
          return;
        }
        setTallies((prev) => ({
          ...prev,
          [loserId]: { ...prev[loserId], net: prev[loserId].net - stake },
          [winnerId]: { ...prev[winnerId], net: prev[winnerId].net + stake },
        }));
        setSettleNote(
          copy.mexen.results.paid(nameOf(loserId), nameOf(winnerId), stake),
        );
      });
    } else if (config.betting) {
      setSettleNote(copy.mexen.results.tie);
    }

    setPhase("results");
  }

  function handleNext() {
    if (!config) return;
    if (roundNo >= config.rounds) {
      setPhase("done");
      return;
    }
    const loserId = resolution?.outcome.loserIds[0];
    if (loserId) setOrder((prev) => reorderLoserFirst(prev, loserId));
    setRoundNo((n) => n + 1);
    setResolution(null);
    setPhase("playing");
  }

  if (phase === "setup") {
    return <MexenSetup members={members} onStart={handleStart} />;
  }

  if (phase === "playing") {
    return (
      <MexenRound
        key={roundNo}
        roomId={roomId}
        order={order}
        roundNo={roundNo}
        totalRounds={config?.rounds ?? 1}
        honderdmanName={honderdmanId ? nameOf(honderdmanId) : null}
        onComplete={handleRoundComplete}
      />
    );
  }

  if (phase === "results" && resolution) {
    return (
      <MexenResults
        resolution={resolution}
        players={order}
        settleNote={settleNote}
        isLastRound={roundNo >= (config?.rounds ?? 1)}
        onNext={handleNext}
      />
    );
  }

  // Final standings, sorted by most losses.
  const standings = [...order].sort(
    (a, b) => (tallies[b.id]?.losses ?? 0) - (tallies[a.id]?.losses ?? 0),
  );
  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold">{copy.mexen.summary.heading}</h3>
      <ul className="space-y-1.5">
        {standings.map((p) => {
          const t = tallies[p.id] ?? { losses: 0, net: 0 };
          return (
            <li
              key={p.id}
              className="flex items-center gap-3 rounded-lg border p-2 text-sm"
            >
              <UserAvatar
                name={p.name}
                avatarUrl={p.avatarUrl}
                loadout={p.loadout}
                className="size-8"
              />
              <span className="flex-1 truncate font-medium">{p.name}</span>
              <span className="text-muted-foreground">
                {copy.mexen.summary.losses(t.losses)}
              </span>
              {config?.betting && (
                <span
                  className={
                    t.net >= 0
                      ? "font-mono tabular-nums text-emerald-600 dark:text-emerald-400"
                      : "font-mono tabular-nums text-red-500"
                  }
                >
                  {copy.mexen.summary.net(t.net)}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <Button className="w-full" onClick={() => setPhase("setup")}>
        {copy.mexen.summary.again}
      </Button>
    </div>
  );
}
