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
  PODIUM_SPLIT_BP,
} from "@/lib/horses/config";
import {
  drawFinishOrder,
  horseNames,
  horsePayout,
  horseStrength,
  legacyFinishOrder,
  mulberry32,
  placeProbabilities,
  podiumMultBps,
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

function randomWinBps(rng: () => number): number[] {
  return winBpsFromStrengths(randomLineup(rng).map(horseStrength));
}

describe("winBpsFromStrengths", () => {
  const rng = mulberry32(42);

  it("always sums to exactly 10000 bp", () => {
    for (let i = 0; i < 500; i++) {
      const bps = randomWinBps(rng);
      expect(bps.reduce((a, b) => a + b, 0)).toBe(10000);
    }
  });

  it("floors every chance at the longshot minimum", () => {
    for (let i = 0; i < 500; i++) {
      const bps = randomWinBps(rng);
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

describe("placeProbabilities", () => {
  const rng = mulberry32(13);

  it("each podium position's probabilities sum to 1 across the field", () => {
    for (let i = 0; i < 200; i++) {
      const probs = placeProbabilities(randomWinBps(rng));
      const sum = (k: "p1" | "p2" | "p3") =>
        probs.reduce((a, p) => a + p[k], 0);
      expect(sum("p1")).toBeCloseTo(1, 9);
      expect(sum("p2")).toBeCloseTo(1, 9);
      expect(sum("p3")).toBeCloseTo(1, 9);
    }
  });

  it("matches the sequential sampler the resolver uses (Monte Carlo)", () => {
    const winBps = randomWinBps(mulberry32(2024));
    const probs = placeProbabilities(winBps);
    const draws = 30_000;
    const counts = Array.from({ length: HORSE_COUNT }, () => [0, 0, 0]);
    const rngMc = mulberry32(777);
    for (let n = 0; n < draws; n++) {
      const order = drawFinishOrder(rngMc, winBps);
      for (let pos = 0; pos < 3; pos++) counts[order[pos]][pos] += 1;
    }
    for (let i = 0; i < HORSE_COUNT; i++) {
      expect(Math.abs(counts[i][0] / draws - probs[i].p1)).toBeLessThan(0.012);
      expect(Math.abs(counts[i][1] / draws - probs[i].p2)).toBeLessThan(0.012);
      expect(Math.abs(counts[i][2] / draws - probs[i].p3)).toBeLessThan(0.012);
    }
  });
});

describe("house edge (EV guard)", () => {
  const rng = mulberry32(7);
  const maxEv = 1 - HORSES_EDGE_BP / 10000;

  it("the podium split returns exactly 1 − edge", () => {
    expect(
      PODIUM_SPLIT_BP.win + PODIUM_SPLIT_BP.second + PODIUM_SPLIT_BP.third,
    ).toBe(10000 - HORSES_EDGE_BP);
  });

  it("EV ≤ bet × (1 − edge) for every horse in every race, all spots combined", () => {
    for (let i = 0; i < 200; i++) {
      const winBps = randomWinBps(rng);
      const probs = placeProbabilities(winBps);
      const mults = podiumMultBps(winBps);
      for (let h = 0; h < HORSE_COUNT; h++) {
        expect(mults[h].mult1Bp).toBeLessThanOrEqual(HORSES_MULT_CAP_BP);
        for (const bet of [HORSES_MIN_BET, 137, 999, HORSES_MAX_BET]) {
          const ev =
            probs[h].p1 * horsePayout(bet, mults[h].mult1Bp) +
            probs[h].p2 * horsePayout(bet, mults[h].mult2Bp) +
            probs[h].p3 * horsePayout(bet, mults[h].mult3Bp);
          expect(ev).toBeLessThanOrEqual(bet * maxEv + 1e-9);
        }
      }
    }
  });

  it("payout flooring never rounds up", () => {
    expect(horsePayout(137, 12_345)).toBe(Math.floor((137 * 12_345) / 10000));
    expect(horsePayout(10, 9_999)).toBe(9);
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
  const lineup = randomLineup(mulberry32(99));

  /** First frame index at which the horse has crossed the line. */
  function crossingFrame(frames: number[][], horse: number): number {
    return frames.findIndex((frame) => frame[horse] >= 1);
  }

  it("is deterministic for the same seed", () => {
    const order = [2, 0, 5, 1, 4, 3];
    const a = raceScript(555, lineup, order);
    const b = raceScript(555, lineup, order);
    expect(a.frames).toEqual(b.frames);
    expect(a.finishOrder).toEqual(order);
  });

  it("the horses cross the line in exactly the drawn podium order", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const order = drawFinishOrder(
        mulberry32(seed),
        [3000, 2500, 2000, 1500, 600, 400],
      );
      const script = raceScript(seed, lineup, order);
      const cross = (h: number) => crossingFrame(script.frames, h);
      expect(cross(order[0])).toBeGreaterThan(0);
      expect(cross(order[0])).toBeLessThan(cross(order[1]));
      expect(cross(order[1])).toBeLessThan(cross(order[2]));
    }
  });

  it("progress is monotonic and within [0, 1]", () => {
    const script = raceScript(31337, lineup, legacyFinishOrder(4));
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
    const script = raceScript(8, lineup, legacyFinishOrder(0));
    expect(scriptProgressAt(script, 0, 0)).toBe(0);
    expect(scriptProgressAt(script, 0, 1)).toBe(1);
    const mid = scriptProgressAt(script, 0, 0.5);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
  });

  it("legacyFinishOrder puts the winner first and keeps everyone", () => {
    expect(legacyFinishOrder(3)).toEqual([3, 0, 1, 2, 4, 5]);
  });
});
