"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { UserAvatar } from "@/components/user-avatar";
import { copy } from "@/lib/copy";
import {
  MEXEN_DEFAULT_ROUNDS,
  MEXEN_DEFAULT_STAKE,
  MEXEN_MAX_PLAYERS,
  MEXEN_MAX_ROUNDS,
  MEXEN_MAX_STAKE,
  MEXEN_MIN_PLAYERS,
  MEXEN_MIN_ROUNDS,
  MEXEN_STAKE_CHIPS,
} from "@/lib/mexen/config";
import type { MexenConfig, MexenPlayer } from "@/lib/mexen/game";
import { cn } from "@/lib/utils";

export function MexenSetup({
  members,
  onStart,
}: {
  members: MexenPlayer[];
  onStart: (config: MexenConfig) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [rounds, setRounds] = useState(MEXEN_DEFAULT_ROUNDS);
  const [betting, setBetting] = useState(false);
  const [stake, setStake] = useState(MEXEN_DEFAULT_STAKE);

  const toggle = (id: string) =>
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MEXEN_MAX_PLAYERS) return prev;
      return [...prev, id];
    });

  const canStart = selected.length >= MEXEN_MIN_PLAYERS;

  function start() {
    if (!canStart) return;
    // Preserve the order in which players were picked as the turn order.
    const players = selected
      .map((id) => members.find((m) => m.id === id))
      .filter((m): m is MexenPlayer => !!m);
    onStart({
      players,
      rounds: Math.min(MEXEN_MAX_ROUNDS, Math.max(MEXEN_MIN_ROUNDS, rounds)),
      betting,
      stake: betting
        ? Math.min(MEXEN_MAX_STAKE, Math.max(1, Math.floor(stake) || 1))
        : 0,
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold">{copy.mexen.setup.heading}</h3>
        <p className="text-sm text-muted-foreground">
          {copy.mexen.setup.playersHint}
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>{copy.mexen.setup.players}</Label>
          <span className="text-xs text-muted-foreground">
            {copy.mexen.setup.selected(selected.length)}
          </span>
        </div>
        <ul className="space-y-1.5">
          {members.map((m) => {
            const isOn = selected.includes(m.id);
            const order = selected.indexOf(m.id) + 1;
            return (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => toggle(m.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg border p-2 text-left transition",
                    isOn
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted",
                  )}
                >
                  <UserAvatar
                    name={m.name}
                    avatarUrl={m.avatarUrl}
                    loadout={m.loadout}
                    className="size-8"
                  />
                  <span className="flex-1 truncate text-sm font-medium">
                    {m.name}
                  </span>
                  {isOn ? (
                    <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs font-bold tabular-nums text-primary-foreground">
                      {order}
                    </span>
                  ) : (
                    <span className="size-6 rounded-full border border-dashed" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="mexen-rounds">{copy.mexen.setup.rounds}</Label>
        <Input
          id="mexen-rounds"
          type="number"
          min={MEXEN_MIN_ROUNDS}
          max={MEXEN_MAX_ROUNDS}
          value={rounds}
          onChange={(e) => setRounds(Number(e.target.value))}
          className="w-24"
        />
      </div>

      <div className="space-y-3 rounded-lg border p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Label htmlFor="mexen-bet" className="font-normal">
              {copy.mexen.setup.bet}
            </Label>
            <p className="text-xs text-muted-foreground">
              {copy.mexen.setup.betHint}
            </p>
          </div>
          <Switch id="mexen-bet" checked={betting} onCheckedChange={setBetting} />
        </div>
        {betting && (
          <div className="space-y-2">
            <Label htmlFor="mexen-stake">{copy.mexen.setup.stake}</Label>
            <Input
              id="mexen-stake"
              type="number"
              min={1}
              value={stake}
              onChange={(e) => setStake(Number(e.target.value))}
            />
            <div className="flex flex-wrap gap-2">
              {MEXEN_STAKE_CHIPS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setStake(c)}
                  className={cn(
                    "size-9 rounded-full border-2 text-xs font-bold tabular-nums transition",
                    stake === c
                      ? "border-amber-400 bg-amber-400/20 text-amber-500"
                      : "border-border text-muted-foreground hover:border-amber-400/50",
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <Button className="w-full" disabled={!canStart} onClick={start}>
        {copy.mexen.setup.start}
      </Button>
      {!canStart && (
        <p className="text-center text-xs text-muted-foreground">
          {copy.mexen.setup.needPlayers}
        </p>
      )}
    </div>
  );
}
