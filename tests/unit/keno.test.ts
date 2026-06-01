import { describe, expect, it } from "vitest";

import {
  KENO_DRAW,
  KENO_MAX_PICKS,
  KENO_PAYTABLE,
  KENO_POOL,
  hyperProb,
} from "@/lib/keno/config";
import { drawKeno, kenoHits, kenoPayout } from "@/lib/keno/engine";

describe("KENO_PAYTABLE house edge", () => {
  for (let k = 1; k <= KENO_MAX_PICKS; k++) {
    it(`${k} picks: RTP ≤ 1 (and > 0.5)`, () => {
      const table = KENO_PAYTABLE[k];
      let rtp = 0;
      for (let h = 0; h <= k; h++) rtp += hyperProb(k, h) * (table[h] ?? 0);
      expect(rtp).toBeLessThanOrEqual(1);
      expect(rtp).toBeGreaterThan(0.5);
    });
  }
});

describe("drawKeno", () => {
  it("draws KENO_DRAW distinct in-range numbers", () => {
    const drawn = drawKeno(() => 0.5);
    expect(drawn).toHaveLength(KENO_DRAW);
    expect(new Set(drawn).size).toBe(KENO_DRAW);
    for (const n of drawn) {
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(KENO_POOL);
    }
  });
});

describe("kenoHits", () => {
  it("counts the picks that were drawn", () => {
    expect(kenoHits([1, 2, 3], [2, 3, 9, 10])).toEqual([2, 3]);
  });
});

describe("kenoPayout", () => {
  it("floors bet × the (picks, hits) multiplier", () => {
    const m = KENO_PAYTABLE[1][1];
    expect(kenoPayout(100, 1, 1)).toBe(Math.floor(100 * m));
  });

  it("0 hits pays nothing", () => {
    expect(kenoPayout(100, 5, 0)).toBe(0);
  });
});
