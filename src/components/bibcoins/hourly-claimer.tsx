"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { claimHourly } from "@/app/_actions/bibcoins";
import { copy } from "@/lib/copy";

/** Invisible: claims the hourly bibcoins trickle once when the app loads. */
export function HourlyClaimer() {
  const claimed = useRef(false);
  useEffect(() => {
    if (claimed.current) return;
    claimed.current = true;
    void claimHourly().then((result) => {
      if (result.ok && result.granted > 0) {
        toast.success(copy.bibcoins.hourlyGranted(result.granted));
      }
    });
  }, []);
  return null;
}
