/**
 * Classic Minesweeper 7-segment style LED counter: bright red digits over a
 * dim "888" ghost on near-black, like the mine counter and timer in the
 * original game.
 */
export function LedDisplay({ value, label }: { value: number; label: string }) {
  const clamped = Math.max(-99, Math.min(999, Math.trunc(value)));
  const text =
    clamped < 0
      ? `-${Math.abs(clamped).toString().padStart(2, "0")}`
      : clamped.toString().padStart(3, "0");

  return (
    <div
      role="status"
      aria-label={`${label}: ${clamped}`}
      className="relative rounded-sm border-2 border-t-[#1c2129] border-l-[#1c2129] border-b-[#5d6675] border-r-[#5d6675] bg-[#180404] px-1.5 py-0.5 font-mono text-2xl font-bold leading-none tracking-widest select-none"
    >
      <span aria-hidden className="text-[#4a0b0b]">
        888
      </span>
      <span
        aria-hidden
        className="absolute inset-0 px-1.5 py-0.5 text-[#ff2a2a] [text-shadow:0_0_6px_rgba(255,42,42,0.55)]"
      >
        {text}
      </span>
    </div>
  );
}
