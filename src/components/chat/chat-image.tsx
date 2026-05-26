"use client";

import { useState } from "react";

import { copy } from "@/lib/copy";
import { cn } from "@/lib/utils";

/** Inline chat image (GIF or uploaded photo) with an expired-photo fallback. */
export function ChatImage({ src, pending }: { src: string; pending?: boolean }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span className="text-xs text-muted-foreground italic">
        {copy.chat.photo.expired}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      onError={() => setFailed(true)}
      className={cn(
        "max-h-48 max-w-[220px] rounded-md",
        pending && "opacity-60",
      )}
      loading="lazy"
    />
  );
}
