import type { ResolvedLoadout } from "@/lib/cosmetics/resolve";
import {
  roundOutcome,
  scoreThrow,
  throwEffects,
  type RoundOutcome,
  type ThrowEffects,
  type ThrowScore,
} from "@/lib/mexen/engine";

/** A seated player (a chosen room member). */
export interface MexenPlayer {
  id: string;
  name: string;
  avatarUrl: string | null;
  loadout: ResolvedLoadout | null;
}

/** Settings chosen on the setup screen. */
export interface MexenConfig {
  players: MexenPlayer[];
  rounds: number;
  betting: boolean;
  stake: number;
}

/** One player's final standing dice for a round. */
export interface MexenFinal {
  playerId: string;
  dice: [number, number];
}

/** Per-player resolution of a finished round (drinks, honderdman, etc.). */
export interface PlayerRoundEffect {
  playerId: string;
  score: ThrowScore;
  effects: ThrowEffects;
  /** The honderdman who drinks for this throw (when a double lands), else null. */
  honderdmanDrinkerId: string | null;
}

export interface RoundResolution {
  perPlayer: PlayerRoundEffect[];
  outcome: RoundOutcome;
  /** Who is honderdman after this round. */
  honderdmanId: string | null;
}

/**
 * Resolve a finished round in turn order. Drink effects are read off each
 * player's *final* throw. The first 11 of the game makes its thrower honderdman;
 * from then on every double makes the standing honderdman drink the pip count.
 */
export function resolveRound(
  finals: MexenFinal[],
  startingHonderdman: string | null,
): RoundResolution {
  let honderdman = startingHonderdman;
  const perPlayer: PlayerRoundEffect[] = finals.map((final) => {
    const score = scoreThrow(final.dice);
    const honderdmanExists = honderdman !== null;
    const effects = throwEffects(score, honderdmanExists);
    const honderdmanDrinkerId = effects.honderdmanDrinksSips > 0 ? honderdman : null;
    if (effects.makesHonderdman) honderdman = final.playerId;
    return { playerId: final.playerId, score, effects, honderdmanDrinkerId };
  });

  return {
    perPlayer,
    outcome: roundOutcome(
      finals.map((f) => ({ playerId: f.playerId, score: scoreThrow(f.dice) })),
    ),
    honderdmanId: honderdman,
  };
}

/** Rotate turn order so `firstId` leads the next round (loser starts). */
export function reorderLoserFirst(
  order: MexenPlayer[],
  firstId: string,
): MexenPlayer[] {
  const idx = order.findIndex((p) => p.id === firstId);
  if (idx <= 0) return order;
  return [...order.slice(idx), ...order.slice(0, idx)];
}
