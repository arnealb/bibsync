import { describe, expect, it } from "vitest";

import {
  CRASH_CHANCE_HOURLY,
  CRASH_FACTOR_MAX,
  CRASH_FACTOR_MIN,
  MANAGEMENT_FEE_DAILY,
  NOISE_CLAMP,
  NOISE_SD_HOURLY,
  PROFIT_SKIM,
  RALLY_CHANCE_HOURLY,
  RALLY_FACTOR_MAX,
  RALLY_FACTOR_MIN,
} from "@/lib/stock/config";
import { applyVolatilityTick, type TickRand } from "@/lib/stock/tick";

/** Deterministic PRNG so the Monte-Carlo guards are reproducible. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal via Box–Muller (mirrors the SQL draw). */
function gauss(rng: () => number): number {
  return Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());
}

function draw(rng: () => number): TickRand {
  return { gauss: gauss(rng), roll: rng(), size: rng() };
}

const KEEP_HOURLY = Math.pow(1 - MANAGEMENT_FEE_DAILY, 1 / 24);
/** gauss 0, roll misses both events, size irrelevant. */
const NEUTRAL: TickRand = { gauss: 0, roll: 0.99, size: 0.5 };
/** The deterministic noise factor at gauss = 0 (mean-1 correction). */
const NOISE_AT_ZERO = Math.exp((-NOISE_SD_HOURLY * NOISE_SD_HOURLY) / 2);

describe("applyVolatilityTick — deterministic pieces", () => {
  it("burns the management fee at the hourly root", () => {
    const r = applyVolatilityTick(100_000, 0, NEUTRAL);
    expect(r.treasury).toBeCloseTo(100_000 * KEEP_HOURLY * NOISE_AT_ZERO, 6);
    expect(r.event).toBeNull();
  });

  it("passes exactly (1 − PROFIT_SKIM) of casino P&L through, both signs", () => {
    const T = 100_000;
    const base = applyVolatilityTick(T, 0, NEUTRAL).treasury;
    const up = applyVolatilityTick(T, 1000, NEUTRAL).treasury;
    const down = applyVolatilityTick(T, -1000, NEUTRAL).treasury;
    const mult = base / T; // fee × noise at this rand
    expect(up - base).toBeCloseTo(1000 * (1 - PROFIT_SKIM) * mult, 6);
    expect(base - down).toBeCloseTo(1000 * (1 - PROFIT_SKIM) * mult, 6);
  });

  it("clamps a single noise tick to ±NOISE_CLAMP", () => {
    const hi = applyVolatilityTick(100_000, 0, { gauss: 50, roll: 0.99, size: 0 });
    const lo = applyVolatilityTick(100_000, 0, { gauss: -50, roll: 0.99, size: 0 });
    expect(hi.treasury).toBeCloseTo(100_000 * KEEP_HOURLY * (1 + NOISE_CLAMP), 6);
    expect(lo.treasury).toBeCloseTo(100_000 * KEEP_HOURLY * (1 - NOISE_CLAMP), 6);
  });

  it("applies a crash inside the configured factor range", () => {
    const noEvent = applyVolatilityTick(100_000, 0, NEUTRAL).treasury;
    const worst = applyVolatilityTick(100_000, 0, { gauss: 0, roll: 0, size: 0 });
    expect(worst.event).toBe("crash");
    expect(worst.treasury).toBeCloseTo(noEvent * CRASH_FACTOR_MIN, 6);
    const mildest = applyVolatilityTick(100_000, 0, { gauss: 0, roll: 0, size: 1 });
    expect(mildest.event).toBe("crash");
    expect(mildest.treasury).toBeCloseTo(noEvent * CRASH_FACTOR_MAX, 6);
  });

  it("applies a rally inside the configured factor range", () => {
    const noEvent = applyVolatilityTick(100_000, 0, NEUTRAL).treasury;
    // roll exactly at the crash bound falls through to the rally branch
    const small = applyVolatilityTick(100_000, 0, {
      gauss: 0,
      roll: CRASH_CHANCE_HOURLY,
      size: 0,
    });
    expect(small.event).toBe("rally");
    expect(small.treasury).toBeCloseTo(noEvent * RALLY_FACTOR_MIN, 6);
    const big = applyVolatilityTick(100_000, 0, {
      gauss: 0,
      roll: CRASH_CHANCE_HOURLY,
      size: 1,
    });
    expect(big.treasury).toBeCloseTo(noEvent * RALLY_FACTOR_MAX, 6);
  });

  it("never returns a negative treasury", () => {
    const r = applyVolatilityTick(1, -1_000_000, { gauss: -50, roll: 0, size: 0 });
    expect(r.treasury).toBe(0);
  });
});

describe("applyVolatilityTick — Monte-Carlo EV guards", () => {
  it("noise + events are EV-neutral: mean tick factor ≈ fee-only keep", () => {
    const rng = mulberry32(0xb1b);
    const N = 200_000;
    let sum = 0;
    let crashes = 0;
    let rallies = 0;
    for (let i = 0; i < N; i++) {
      const r = applyVolatilityTick(1, 0, draw(rng));
      sum += r.treasury;
      if (r.event === "crash") crashes++;
      if (r.event === "rally") rallies++;
    }
    const mean = sum / N;
    expect(mean).toBeGreaterThan(KEEP_HOURLY - 0.001);
    expect(mean).toBeLessThan(KEEP_HOURLY + 0.001);
    expect(crashes / N).toBeGreaterThan(CRASH_CHANCE_HOURLY * 0.7);
    expect(crashes / N).toBeLessThan(CRASH_CHANCE_HOURLY * 1.3);
    expect(rallies / N).toBeGreaterThan(RALLY_CHANCE_HOURLY * 0.8);
    expect(rallies / N).toBeLessThan(RALLY_CHANCE_HOURLY * 1.2);
  });

  it("drifts down when the casino is quiet (fee dominates)", () => {
    const rng = mulberry32(42);
    let tre = 1_000_000;
    for (let i = 0; i < 24 * 60; i++) {
      tre = applyVolatilityTick(tre, 0, draw(rng)).treasury;
    }
    expect(tre).toBeLessThan(1_000_000);
  });
});
