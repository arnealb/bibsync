import { getBibcoins } from "@/lib/bibcoins/queries";
import { HORSE_COUNT, type HorseColor } from "@/lib/horses/config";
import type { HorseRace, RaceHorse } from "@/lib/horses/engine";
import { createClient } from "@/lib/supabase/server";

export interface HorseBetView {
  id: string;
  userId: string;
  name: string;
  horseIdx: number;
  amount: number;
  payout: number | null;
}

export interface HorsesState {
  /** The open race (betting window) — null only if the cron never ran. */
  race: HorseRace | null;
  /** The most recently resolved race (results + replay). */
  lastRace: HorseRace | null;
  raceBets: HorseBetView[];
  lastBets: HorseBetView[];
  /** Winning colours of the latest resolved races, newest first. */
  recentWinners: { raceId: number; color: HorseColor }[];
  balance: number;
}

interface RaceRow {
  id: number;
  runs_at: string;
  status: string;
  horses: unknown;
  name_seed: number;
  run_seed: number | null;
  winner_idx: number | null;
}

/** Defensive parse of the jsonb horses column — never trust external data. */
function parseRace(row: RaceRow): HorseRace | null {
  const horses = row.horses;
  if (!Array.isArray(horses) || horses.length !== HORSE_COUNT) return null;
  const parsed: RaceHorse[] = [];
  for (const h of horses) {
    const horse = h as Partial<RaceHorse>;
    if (
      typeof horse.color !== "string" ||
      typeof horse.speed !== "number" ||
      typeof horse.stamina !== "number" ||
      typeof horse.sprint !== "number" ||
      typeof horse.winBp !== "number" ||
      typeof horse.multBp !== "number"
    ) {
      return null;
    }
    parsed.push(horse as RaceHorse);
  }
  if (row.status !== "open" && row.status !== "resolved") return null;
  return {
    id: row.id,
    runsAt: row.runs_at,
    status: row.status,
    horses: parsed,
    nameSeed: row.name_seed,
    runSeed: row.run_seed,
    winnerIdx: row.winner_idx,
  };
}

/** The full racebook view for one user: races, bets (with names), balance. */
export async function getHorsesState(userId: string): Promise<HorsesState> {
  const supabase = await createClient();
  const empty: HorsesState = {
    race: null,
    lastRace: null,
    raceBets: [],
    lastBets: [],
    recentWinners: [],
    balance: 0,
  };

  const { data: raceRows, error: racesError } = await supabase
    .from("horse_races")
    .select("*")
    .order("runs_at", { ascending: false })
    .limit(10);
  if (racesError) {
    console.error("[getHorsesState] races", racesError);
    return { ...empty, balance: await getBibcoins(userId) };
  }

  const races = (raceRows ?? [])
    .map((r) => parseRace(r as RaceRow))
    .filter((r): r is HorseRace => r !== null);
  const race = races.find((r) => r.status === "open") ?? null;
  const resolved = races.filter((r) => r.status === "resolved");
  const lastRace = resolved[0] ?? null;
  const recentWinners = resolved
    .filter((r) => r.winnerIdx !== null)
    .map((r) => ({
      raceId: r.id,
      color: r.horses[r.winnerIdx as number].color,
    }));

  const raceIds = [race?.id, lastRace?.id].filter(
    (id): id is number => id !== undefined,
  );
  if (raceIds.length === 0) {
    return { ...empty, balance: await getBibcoins(userId) };
  }

  const { data: betRows, error: betsError } = await supabase
    .from("horse_race_bets")
    .select("id, race_id, user_id, horse_idx, amount, payout")
    .in("race_id", raceIds)
    .order("created_at", { ascending: false })
    .limit(200);
  if (betsError) console.error("[getHorsesState] bets", betsError);
  const bets = betRows ?? [];

  const userIds = [...new Set(bets.map((b) => b.user_id))];
  const names = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", userIds);
    if (profilesError) console.error("[getHorsesState] profiles", profilesError);
    for (const p of profiles ?? []) names.set(p.id, p.display_name);
  }

  const toView = (b: (typeof bets)[number]): HorseBetView => ({
    id: b.id,
    userId: b.user_id,
    name: names.get(b.user_id) ?? "???",
    horseIdx: b.horse_idx,
    amount: b.amount,
    payout: b.payout,
  });

  return {
    race,
    lastRace,
    raceBets: bets.filter((b) => b.race_id === race?.id).map(toView),
    lastBets: bets.filter((b) => b.race_id === lastRace?.id).map(toView),
    recentWinners,
    balance: await getBibcoins(userId),
  };
}
