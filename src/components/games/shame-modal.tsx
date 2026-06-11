"use client";

import { useEffect } from "react";

import { copy } from "@/lib/copy";

const KEYFRAMES = `@keyframes shame-slide {
  0% { background-position: 0% 50%; }
  100% { background-position: 200% 50%; }
}`;

const RAINBOW =
  "linear-gradient(90deg, #ef4444, #f97316, #eab308, #22c55e, #3b82f6, #a855f7, #ef4444, #f97316, #eab308, #22c55e, #3b82f6, #a855f7)";

export function ShameModal({
  message,
  onDone,
}: {
  message: string;
  onDone: () => void;
}) {
  useEffect(() => {
    const id = setTimeout(onDone, 3500);
    return () => clearTimeout(id);
  }, [onDone]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onDone}
    >
      <style>{KEYFRAMES}</style>
      <div
        className="rounded-xl shadow-2xl"
        style={{
          padding: "4px",
          background: RAINBOW,
          backgroundSize: "200% 100%",
          animation: "shame-slide 1.5s linear infinite",
        }}
      >
        <div className="max-w-[300px] rounded-[9px] bg-card px-6 py-5 text-center">
          <p className="text-base font-bold leading-snug">{message}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            {copy.games.shameClose}
          </p>
        </div>
      </div>
    </div>
  );
}

export function pickShameMsg(): string {
  const msgs = copy.games.shameMsgs;
  return msgs[Math.floor(Math.random() * msgs.length)];
}
