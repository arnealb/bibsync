"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { claimDaily } from "@/app/_actions/bibcoins";
import { copy } from "@/lib/copy";

/** Invisible: claims the once-a-day login bonus when the app loads. */
export function DailyClaimer() {
  const claimed = useRef(false);
  useEffect(() => {
    if (claimed.current) return;
    claimed.current = true;
    void claimDaily().then((result) => {
      if (result.ok && result.granted > 0) {
        toast.success(copy.bibcoins.dailyGranted(result.granted));
      }
    });
  }, []);
  return null;
}
