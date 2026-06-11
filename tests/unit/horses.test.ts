import { describe, expect, it } from "vitest";

import {
  HORSE_COUNT,
  HORSE_STAT_MAX,
  HORSE_STAT_MIN,
  HORSES_EDGE_BP,
  HORSES_MAX_BET,
  HORSES_MIN_BET,
  HORSES_MIN_WIN_BP,
  HORSES_MULT_CAP_BP,
} from "@/lib/horses/config";
import {
  horseNames,
  horsePayout,
  horseStrength,
  mulberry32,
  multBpFromWinBp,
  raceScript,
  scriptProgressAt,
  winBpsFromStrengths,
  type HorseStats,
} from "@/lib/horses/engine";

/** Deterministic random race line-ups (mirror of the SQL stat rolls). */
function randomStats(rng: () => number): HorseStats {
  const roll = () =>
    HORSE_STAT_MIN +
    Math.floor(rng() * (HORSE_STAT_MAX - HORSE_STAT_MIN + 1));
  return { speed: roll(), stamina: roll(), sprint: roll() };
}

function randomLineup(rng: () => number): HorseStats[] {
  return Array.from({ length: HORSE_COUNT }, () => randomStats(rng));
}

describe("winBpsFromStrengths", () => {
  const rng = mulberry32(42);

  it("always sums to exactly 10000 bp", () => {
    for (let i = 0; i < 500; i++) {
      const bps = winBpsFromStrengths(randomLineup(rng).map(horseStrength));
      expect(bps.reduce((a, b) => a + b, 0)).toBe(10000);
    }
  });

  it("floors every chance at the longshot minimum", () => {
    for (let i = 0; i < 500; i++) {
      const bps = winBpsFromStrengths(randomLineup(rng).map(horseStrength));
      for (const bp of bps) expect(bp).toBeGreaterThanOrEqual(HORSES_MIN_WIN_BP);
    }
  });

  it("survives the most lopsided field (one weak vs five max horses)", () => {
    const strengths = [
      horseStrength({ speed: 40, stamina: 40, sprint: 40 }),
      ...Array.from({ length: 5 }, () =>
        horseStrength({ speed: 99, stamina: 99, sprint: 99 }),
      ),
    ];
    const bps = winBpsFromStrengths(strengths);
    expect(bps.reduce((a, b) => a + b, 0)).toBe(10000);
    expect(Math.min(...bps)).toBeGreaterThanOrEqual(HORSES_MIN_WIN_BP);
  });

  it("gives a stronger horse a bigger chance", () => {
    const bps = winBpsFromStrengths([60, 90, 60, 60, 60, 60]);
    expect(bps[1]).toBe(Math.max(...bps));
  });
});

describe("house edge (EV guard)", () => {
  const rng = mulberry32(7);
  const maxEv = 1 - HORSES_EDGE_BP / 10000;

  it("EV ≤ bet × (1 − edge) for every horse in every race, floor never rounds up", () => {
    for (let i = 0; i < 300; i++) {
      const bps = winBpsFromStrengths(randomLineup(rng).map(horseStrength));
      for (const winBp of bps) {
        const multBp = multBpFromWinBp(winBp);
        expect(multBp).toBeLessThanOrEqual(HORSES_MULT_CAP_BP);
        for (const bet of [HORSES_MIN_BET, 137, 999, HORSES_MAX_BET]) {
          const payout = horsePayout(bet, multBp);
          expect(payout).toBeLessThanOrEqual((bet * multBp) / 10000);
          const ev = (winBp / 10000) * payout;
          expect(ev).toBeLessThanOrEqual(bet * maxEv + 1e-9);
        }
      }
    }
  });

  it("longshot odds stay fair after the floor (cap never binds)", () => {
    expect(multBpFromWinBp(HORSES_MIN_WIN_BP)).toBe(475_000);
    expect(multBpFromWinBp(HORSES_MIN_WIN_BP)).toBeLessThan(HORSES_MULT_CAP_BP);
  });
});

describe("horseNames", () => {
  it("is deterministic and distinct per race seed", () => {
    const a = horseNames(123456);
    const b = horseNames(123456);
    expect(a).toEqual(b);
    expect(new Set(a).size).toBe(HORSE_COUNT);
    expect(a).not.toEqual(horseNames(654321));
  });
});

describe("raceScript", () => {
  const rng = mulberry32(99);
  const lineup = randomLineup(rng).map((s, i) => ({
    ...s,
    color: "red" as const,
    winBp: 1666,
    multBp: 57000,
    idx: i,
  }));

  it("is deterministic for the same seed", () => {
    const a = raceScript(555, lineup, 2);
    const b = raceScript(555, lineup, 2);
    expect(a.frames).toEqual(b.frames);
    expect(a.finishOrder).toEqual(b.finishOrder);
  });

  it("the drawn winner always crosses the line first", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const winner = seed % HORSE_COUNT;
      const script = raceScript(seed, lineup, winner);
      expect(script.finishOrder[0]).toBe(winner);

      // The first frame where any horse hits 1 must be the winner's.
      const firstFinish = script.frames.findIndex((frame) =>
        frame.some((p) => p >= 1),
      );
      expect(firstFinish).toBeGreaterThan(0);
      const finishersAtFirst = script.frames[firstFinish]
        .map((p, i) => (p >= 1 ? i : -1))
        .filter((i) => i >= 0);
      expect(finishersAtFirst).toEqual([winner]);
    }
  });

  it("progress is monotonic and within [0, 1]", () => {
    const script = raceScript(31337, lineup, 4);
    for (let i = 0; i < HORSE_COUNT; i++) {
      let prev = 0;
      for (const frame of script.frames) {
        expect(frame[i]).toBeGreaterThanOrEqual(prev);
        expect(frame[i]).toBeLessThanOrEqual(1);
        prev = frame[i];
      }
      expect(prev).toBeGreaterThan(0.9); // everyone is near the line at the end
    }
  });

  it("interpolates between frames", () => {
    const script = raceScript(8, lineup, 0);
    expect(scriptProgressAt(script, 0, 0)).toBe(0);
    expect(scriptProgressAt(script, 0, 1)).toBe(1);
    const mid = scriptProgressAt(script, 0, 0.5);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
  });
});
