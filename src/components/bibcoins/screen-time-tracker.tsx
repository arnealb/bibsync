"use client";

import { useEffect, useRef } from "react";

import { pingScreenTime } from "@/app/_actions/screen-time";
import { SCREEN_TIME_HEARTBEAT_MS } from "@/lib/bibcoins/config";

/**
 * Invisible: sends a screen-time heartbeat every minute while the tab is
 * visible. The server measures the real elapsed time between beats (capped) and
 * pays the daily screen-time reward, so this client just needs to fire on an
 * interval and re-sync the baseline (`resume`) whenever the tab regains focus —
 * that way time on a hidden/backgrounded tab is never counted.
 */
export function ScreenTimeTracker() {
  const inFlight = useRef(false);

  useEffect(() => {
    let active = true;

    const ping = async (resume: boolean) => {
      if (inFlight.current) return;
      inFlight.current = true;
      try {
        await pingScreenTime(resume);
      } catch (error) {
        console.error("[ScreenTimeTracker]", error);
      } finally {
        if (active) inFlight.current = false;
      }
    };

    // Establish the baseline; the first beat counts nothing.
    void ping(true);

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") void ping(false);
    }, SCREEN_TIME_HEARTBEAT_MS);

    const onVisibility = () => {
      // Going hidden: record the visible time up to now. Coming back: reset the
      // baseline so the hidden gap is dropped.
      void ping(document.visibilityState !== "visible" ? false : true);
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      active = false;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return null;
}
