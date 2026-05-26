import { describe, expect, it } from "vitest";

import {
  applyInput,
  createInitialState,
  GRID,
  nextSpeedMs,
  tick,
  type SnakeState,
} from "@/lib/games/snake/engine";

describe("snake engine — initial state", () => {
  it("places one snake cell in the middle and food elsewhere", () => {
    const state = createInitialState(42);
    expect(state.snake).toHaveLength(1);
    expect(state.score).toBe(0);
    expect(state.gameOver).toBe(false);
    expect(state.dir).toBe("right");
    expect(state.inputQueue).toEqual([]);
    expect(state.food).not.toEqual(state.snake[0]);
  });

  it("is deterministic for the same seed", () => {
    const a = createInitialState(123);
    const b = createInitialState(123);
    expect(a.food).toEqual(b.food);
    expect(a.rngSeed).toEqual(b.rngSeed);
  });
});

describe("snake engine — tick movement", () => {
  it("moves the head one cell in the current direction", () => {
    const state = createInitialState(42);
    const next = tick(state);
    expect(next.snake[0]?.x).toBe(state.snake[0]!.x + 1);
    expect(next.snake[0]?.y).toBe(state.snake[0]!.y);
    expect(next.tickCount).toBe(1);
  });

  it("keeps snake length 1 when not eating", () => {
    const state: SnakeState = {
      snake: [{ x: 5, y: 5 }],
      food: { x: 10, y: 10 },
      dir: "right",
      inputQueue: [],
      score: 0,
      gameOver: false,
      tickCount: 0,
      rngSeed: 1,
    };
    const next = tick(state);
    expect(next.snake).toHaveLength(1);
    expect(next.score).toBe(0);
  });
});

describe("snake engine — eating food", () => {
  it("grows the snake and increases score", () => {
    const state: SnakeState = {
      snake: [{ x: 5, y: 5 }],
      food: { x: 6, y: 5 },
      dir: "right",
      inputQueue: [],
      score: 0,
      gameOver: false,
      tickCount: 0,
      rngSeed: 1,
    };
    const next = tick(state);
    expect(next.snake[0]).toEqual({ x: 6, y: 5 });
    expect(next.snake).toHaveLength(2);
    expect(next.score).toBe(1);
  });

  it("places new food off the snake after eating", () => {
    const state: SnakeState = {
      snake: [{ x: 5, y: 5 }],
      food: { x: 6, y: 5 },
      dir: "right",
      inputQueue: [],
      score: 0, gameOver: false, tickCount: 0, rngSeed: 1,
    };
    const next = tick(state);
    expect(next.snake).not.toContainEqual(next.food);
  });
});

describe("snake engine — collisions", () => {
  it("ends the game when hitting a wall", () => {
    const state: SnakeState = {
      snake: [{ x: GRID - 1, y: 5 }],
      food: { x: 0, y: 0 },
      dir: "right",
      inputQueue: [],
      score: 0, gameOver: false, tickCount: 0, rngSeed: 1,
    };
    const next = tick(state);
    expect(next.gameOver).toBe(true);
  });

  it("ends the game when hitting itself", () => {
    const state: SnakeState = {
      snake: [
        { x: 5, y: 5 },
        { x: 4, y: 5 },
        { x: 4, y: 4 },
        { x: 5, y: 4 },
      ],
      food: { x: 0, y: 0 },
      dir: "up",
      inputQueue: [],
      score: 0, gameOver: false, tickCount: 0, rngSeed: 1,
    };
    const next = tick(state);
    expect(next.gameOver).toBe(true);
  });

  it("does not move once gameOver is true", () => {
    const dead: SnakeState = {
      snake: [{ x: 5, y: 5 }],
      food: { x: 0, y: 0 },
      dir: "right",
      inputQueue: [],
      score: 0, gameOver: true, tickCount: 0, rngSeed: 1,
    };
    expect(tick(dead)).toEqual(dead);
  });
});

describe("snake engine — input", () => {
  it("queues the next direction", () => {
    const state = createInitialState(1);
    const turned = applyInput(state, "up");
    expect(turned.inputQueue).toEqual(["up"]);
    expect(turned.dir).toBe("right");
    const ticked = tick(turned);
    expect(ticked.dir).toBe("up");
    expect(ticked.inputQueue).toEqual([]);
  });

  it("rejects 180-degree turns against the committed direction", () => {
    const state = createInitialState(1);
    const blocked = applyInput(state, "left");
    expect(blocked.inputQueue).toEqual([]);
  });

  it("accepts a 90-degree chain across one tick interval (up then left while moving right)", () => {
    const state = createInitialState(1);
    const afterUp = applyInput(state, "up");
    const afterLeft = applyInput(afterUp, "left");
    expect(afterLeft.inputQueue).toEqual(["up", "left"]);
    const t1 = tick(afterLeft);
    expect(t1.dir).toBe("up");
    expect(t1.inputQueue).toEqual(["left"]);
    const t2 = tick(t1);
    expect(t2.dir).toBe("left");
    expect(t2.inputQueue).toEqual([]);
  });

  it("rejects a queued direction that would reverse the previous queued one", () => {
    const state = createInitialState(1);
    const afterUp = applyInput(state, "up");
    const afterDown = applyInput(afterUp, "down");
    expect(afterDown.inputQueue).toEqual(["up"]);
  });

  it("drops a queued direction equal to the previous queued one", () => {
    const state = createInitialState(1);
    const afterUp = applyInput(state, "up");
    const afterUpAgain = applyInput(afterUp, "up");
    expect(afterUpAgain.inputQueue).toEqual(["up"]);
  });

  it("caps the input queue at two", () => {
    const state = createInitialState(1);
    const a = applyInput(state, "up");
    const b = applyInput(a, "left");
    const c = applyInput(b, "down");
    expect(c.inputQueue).toEqual(["up", "left"]);
  });

  it("ignores input after gameOver", () => {
    const dead: SnakeState = {
      snake: [{ x: 5, y: 5 }],
      food: { x: 0, y: 0 },
      dir: "right",
      inputQueue: [],
      score: 0, gameOver: true, tickCount: 0, rngSeed: 1,
    };
    expect(applyInput(dead, "up")).toEqual(dead);
  });
});

describe("snake engine — speed curve", () => {
  it("speeds up as score grows, clamped at 80ms", () => {
    expect(nextSpeedMs(0)).toBe(160);
    expect(nextSpeedMs(5)).toBeLessThan(nextSpeedMs(0));
    expect(nextSpeedMs(1000)).toBe(80);
  });
});
