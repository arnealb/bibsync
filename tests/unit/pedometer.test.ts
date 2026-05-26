import { describe, expect, it } from "vitest";

import { createStepDetector } from "@/lib/steps/pedometer";

const GRAVITY = 9.81;

/**
 * Feeds a synthetic walking signal (gravity + a sine swing) to a detector and
 * returns the step count. One sine period ≈ one stride.
 */
function walk({
  hz,
  seconds,
  amplitude = 3,
  sampleHz = 50,
}: {
  hz: number;
  seconds: number;
  amplitude?: number;
  sampleHz?: number;
}): number {
  const detector = createStepDetector();
  const dt = 1000 / sampleHz;
  const samples = Math.round(seconds * sampleHz);
  for (let i = 0; i < samples; i++) {
    const t = i * dt;
    const magnitude =
      GRAVITY + amplitude * Math.sin((2 * Math.PI * hz * t) / 1000);
    detector.push(magnitude, t);
  }
  return detector.count;
}

describe("createStepDetector", () => {
  it("counts roughly one step per stride while walking (~2 Hz)", () => {
    // 2 Hz for 5 s → ~10 strides.
    const count = walk({ hz: 2, seconds: 5 });
    expect(count).toBeGreaterThanOrEqual(8);
    expect(count).toBeLessThanOrEqual(11);
  });

  it("tracks a slower cadence (~1.5 Hz)", () => {
    // 1.5 Hz for 8 s → ~12 strides.
    const count = walk({ hz: 1.5, seconds: 8 });
    expect(count).toBeGreaterThanOrEqual(10);
    expect(count).toBeLessThanOrEqual(13);
  });

  it("counts nothing when the phone is still", () => {
    const detector = createStepDetector();
    for (let i = 0; i < 300; i++) {
      // tiny sensor jitter, well under the threshold
      detector.push(GRAVITY + (i % 2 === 0 ? 0.05 : -0.05), i * 20);
    }
    expect(detector.count).toBe(0);
  });

  it("debounces: a single sustained spike is at most one step", () => {
    const detector = createStepDetector();
    detector.push(GRAVITY, 0);
    detector.push(GRAVITY + 6, 10);
    detector.push(GRAVITY + 6, 20);
    detector.push(GRAVITY + 6, 30);
    expect(detector.count).toBeLessThanOrEqual(1);
  });

  it("ignores non-finite samples", () => {
    const detector = createStepDetector();
    expect(detector.push(Number.NaN, 0)).toBe(0);
    expect(detector.push(GRAVITY, Number.POSITIVE_INFINITY)).toBe(0);
    expect(detector.count).toBe(0);
  });

  it("reset() clears the count", () => {
    const detector = createStepDetector();
    detector.push(GRAVITY, 0);
    detector.push(GRAVITY + 6, 300);
    expect(detector.count).toBe(1);
    detector.reset();
    expect(detector.count).toBe(0);
  });
});
