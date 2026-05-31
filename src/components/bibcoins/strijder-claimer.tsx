"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { claimStrijder } from "@/app/_actions/bibcoins";
import { copy } from "@/lib/copy";

/**
 * Invisible: grabs the "Strijder" night-owl bonus (1000 bibcoins) while you're
 * online between 00:30 and 01:30 Brussels. Only pings the server during the
 * local night hours (00:xx / 01:xx) — the server enforces the exact window and
 * the once-a-day rule, so retrying is a cheap no-op.
 */
export function StrijderClaimer() {
  const done = useRef(false);

  useEffect(() => {
    function attempt() {
      if (done.current) return;
      const h = new Date().getHours();
      if (h !== 0 && h !== 1) return; // not the night window locally
      void claimStrijder().then((result) => {
        if (result.ok && result.granted > 0) {
          done.current = true;
          toast.success(copy.bibcoins.strijderGranted(result.granted));
        }
      });
    }

    attempt();
    const id = window.setInterval(attempt, 60_000);
    return () => window.clearInterval(id);
  }, []);

  return null;
}
