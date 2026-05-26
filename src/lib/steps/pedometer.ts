/**
 * A tiny, pure step detector for accelerometer magnitude samples.
 *
 * Walking produces a roughly periodic acceleration signal. We low-pass the
 * magnitude to estimate the slow-moving gravity baseline, subtract it, and
 * count one step per significant upward swing — with hysteresis (the signal
 * must dip down before the next step can fire) and a debounce interval so a
 * single stride can't register twice.
 *
 * Pure and deterministic: feed it `(magnitude, timestampMs)` and it returns
 * the number of steps that sample produced (0 or 1). No globals, no clock.
 */

export interface StepDetectorOptions {
  /** Dynamic acceleration (m/s²) needed to fire a step. */
  threshold?: number;
  /** Minimum time between two counted steps (ms). */
  minIntervalMs?: number;
  /** Low-pass factor for the gravity baseline, in [0, 1). Higher = slower. */
  smoothing?: number;
}

export interface StepDetector {
  /** Feeds one magnitude sample; returns steps added (0 or 1). */
  push(magnitude: number, timestampMs: number): number;
  /** Steps counted since the last reset. */
  readonly count: number;
  /** Clears all internal state. */
  reset(): void;
}

const DEFAULTS = {
  threshold: 1.2,
  minIntervalMs: 250,
  smoothing: 0.97,
} as const;

export function createStepDetector(
  options: StepDetectorOptions = {},
): StepDetector {
  const threshold = options.threshold ?? DEFAULTS.threshold;
  const minIntervalMs = options.minIntervalMs ?? DEFAULTS.minIntervalMs;
  const smoothing = options.smoothing ?? DEFAULTS.smoothing;
  // Re-arm once the signal swings clearly below the baseline again.
  const reArmThreshold = -threshold * 0.5;

  let baseline = Number.NaN; // lazily initialised on the first sample
  let armed = true;
  let lastStepAt = Number.NEGATIVE_INFINITY;
  let count = 0;

  return {
    push(magnitude, timestampMs) {
      if (!Number.isFinite(magnitude) || !Number.isFinite(timestampMs)) {
        return 0;
      }
      if (Number.isNaN(baseline)) {
        baseline = magnitude; // start at gravity, no warm-up needed
        return 0;
      }

      baseline = smoothing * baseline + (1 - smoothing) * magnitude;
      const dynamic = magnitude - baseline;

      if (dynamic < reArmThreshold) {
        armed = true;
      }

      if (
        armed &&
        dynamic > threshold &&
        timestampMs - lastStepAt >= minIntervalMs
      ) {
        armed = false;
        lastStepAt = timestampMs;
        count += 1;
        return 1;
      }
      return 0;
    },
    get count() {
      return count;
    },
    reset() {
      baseline = Number.NaN;
      armed = true;
      lastStepAt = Number.NEGATIVE_INFINITY;
      count = 0;
    },
  };
}
