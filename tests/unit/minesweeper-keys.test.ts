import { describe, expect, it } from "vitest";

import { ARCADE_COINS_PER_EVENT } from "@/lib/bibcoins/config";
import { MINESWEEPER_DIFFICULTIES } from "@/lib/games/minesweeper/engine";
import { MINESWEEPER_GAME_KEYS } from "@/lib/games/minesweeper/keys";
import { ARCADE_REASONS } from "@/lib/games/arcade-window";
import { GAME_KEYS } from "@/lib/validation/games";

describe("minesweeper game keys", () => {
  it("maps every difficulty to its own valid game key", () => {
    const keys = Object.values(MINESWEEPER_GAME_KEYS);
    expect(Object.keys(MINESWEEPER_GAME_KEYS).sort()).toEqual(
      Object.keys(MINESWEEPER_DIFFICULTIES).sort(),
    );
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) {
      expect(GAME_KEYS).toContain(key);
    }
  });

  it("every difficulty key pays coins and draws from the hourly cap", () => {
    for (const key of Object.values(MINESWEEPER_GAME_KEYS)) {
      expect(
        ARCADE_COINS_PER_EVENT[key as keyof typeof ARCADE_COINS_PER_EVENT],
      ).toBeGreaterThan(0);
      expect(ARCADE_REASONS).toContain(key);
    }
  });
});
