"use client";

import { ROULETTE_SPIN_MS } from "@/lib/roulette/config";
import { WHEEL_ORDER, colorOf } from "@/lib/roulette/engine";

const SEG = 360 / 37;
const COLOR: Record<string, string> = {
  red: "#dc2626",
  black: "#1c1c1c",
  green: "#15803d",
};

const CONIC = `conic-gradient(from ${-SEG / 2}deg, ${WHEEL_ORDER.map(
  (n, i) => `${COLOR[colorOf(n)]} ${i * SEG}deg ${(i + 1) * SEG}deg`,
).join(", ")})`;

/** Returns the absolute rotation (deg) that lands `number` under the top
 *  pointer, spinning forward several turns from `from`. */
export function rotationFor(from: number, number: number): number {
  const idx = WHEEL_ORDER.indexOf(number);
  const targetMod = (360 - idx * SEG) % 360;
  const currentMod = ((from % 360) + 360) % 360;
  const delta = (targetMod - currentMod + 360) % 360;
  return from + 360 * 6 + delta;
}

export function RouletteWheel({ rotation }: { rotation: number }) {
  return (
    <div className="relative mx-auto aspect-square w-60 max-w-full sm:w-64">
      {/* pointer */}
      <div className="absolute left-1/2 top-0 z-20 size-0 -translate-x-1/2 border-x-8 border-t-[16px] border-x-transparent border-t-amber-400 drop-shadow" />
      {/* spinning wheel */}
      <div
        className="absolute inset-0 rounded-full border-[6px] border-amber-700/70 shadow-2xl"
        style={{
          background: CONIC,
          transform: `rotate(${rotation}deg)`,
          transition: `transform ${ROULETTE_SPIN_MS}ms cubic-bezier(0.15, 0.85, 0.2, 1)`,
        }}
      >
        {WHEEL_ORDER.map((n, i) => (
          <span
            key={n}
            className="absolute left-1/2 top-1/2 font-bold text-white"
            style={{
              fontSize: "9px",
              transformOrigin: "0 0",
              transform: `rotate(${i * SEG}deg) translate(-3px, -106px) rotate(${-i * SEG}deg)`,
            }}
          >
            {n}
          </span>
        ))}
      </div>
      {/* hub */}
      <div className="absolute left-1/2 top-1/2 z-10 flex size-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 border-amber-700/70 bg-background">
        <span className="text-xs text-muted-foreground">🎯</span>
      </div>
    </div>
  );
}
