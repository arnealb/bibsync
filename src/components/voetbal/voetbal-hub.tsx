"use client";

import { useEffect, useState } from "react";

import { getVoetbalHourEarned } from "@/app/_actions/voetbal";
import { Button } from "@/components/ui/button";
import { HogerLagerGame } from "@/components/voetbal/games/hoger-lager-game";
import { MysteryGame } from "@/components/voetbal/games/mystery-game";
import { NameGame } from "@/components/voetbal/games/name-game";
import { QuizGame } from "@/components/voetbal/games/quiz-game";
import { VoetbalCapBar } from "@/components/voetbal/voetbal-cap-bar";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { VOETBAL_MODES, type VoetbalMode } from "@/lib/voetbal/modes";

export function VoetbalHub({
  roomId,
  initialHourEarned,
}: {
  roomId: string;
  initialHourEarned: number;
}) {
  const [mode, setMode] = useState<VoetbalMode | null>(null);
  const [hourEarned, setHourEarned] = useState(initialHourEarned);

  // Refresh the cap bar whenever we return to the menu.
  useEffect(() => {
    if (mode !== null) return;
    void getVoetbalHourEarned().then(setHourEarned);
  }, [mode]);

  const games: Record<VoetbalMode, React.ReactNode> = {
    namen: <NameGame roomId={roomId} onEarned={setHourEarned} />,
    hogerlager: <HogerLagerGame roomId={roomId} onEarned={setHourEarned} />,
    quiz: <QuizGame roomId={roomId} onEarned={setHourEarned} />,
    mystery: <MysteryGame roomId={roomId} onEarned={setHourEarned} />,
  };

  return (
    <div className="space-y-5">
      <VoetbalCapBar earned={hourEarned} />

      {mode === null ? (
        <div className="space-y-3">
          <p className="text-sm font-medium">{copy.voetbal.chooseGame}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {VOETBAL_MODES.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setMode(m.key)}
                className={cn(
                  "flex items-center gap-3 rounded-xl border p-4 text-left transition-colors hover:bg-muted",
                )}
              >
                <span className="text-3xl">{m.emoji}</span>
                <span className="min-w-0">
                  <span className="block font-semibold">
                    {copy.voetbal.modes[m.key].label}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {copy.voetbal.modes[m.key].desc}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <Button variant="ghost" size="sm" onClick={() => setMode(null)}>
            {copy.voetbal.back}
          </Button>
          {games[mode]}
        </div>
      )}
    </div>
  );
}
