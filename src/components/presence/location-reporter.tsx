"use client";

import { useEffect, useRef, useState } from "react";

import { reportLocation } from "@/app/_actions/presence";
import { copy } from "@/lib/copy";

/** How often to re-check the browser position while the app is open. */
const REPORT_INTERVAL_MS = 3 * 60 * 1000;

type ReporterState =
  | "no-location"
  | "checking"
  | "on"
  | "denied"
  | "unsupported"
  | "error";

const MESSAGE: Record<Exclude<ReporterState, "no-location">, string> = {
  checking: copy.presence.location.checking,
  on: copy.presence.location.on,
  denied: copy.presence.location.denied,
  unsupported: copy.presence.location.unsupported,
  error: copy.presence.location.error,
};

/**
 * Periodically sends the browser position to the server, which compares it to
 * the room geofence and records whether the user is "ter plaatse". Only renders
 * a small status line; the actual presence chips live in the sidebar list.
 */
export function LocationReporter({
  roomId,
  hasLocation,
  canManage,
}: {
  roomId: string;
  hasLocation: boolean;
  canManage: boolean;
}) {
  const [state, setState] = useState<ReporterState>(
    hasLocation ? "checking" : "no-location",
  );
  const checkRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!hasLocation) return;
    let cancelled = false;

    function check() {
      if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
        if (!cancelled) setState("unsupported");
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (cancelled) return;
          void reportLocation({
            roomId,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          }).then((result) => {
            if (!cancelled) setState(result.ok ? "on" : "error");
          });
        },
        (err) => {
          if (cancelled) return;
          setState(err.code === err.PERMISSION_DENIED ? "denied" : "error");
        },
        { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
      );
    }

    checkRef.current = check;
    check();
    const id = window.setInterval(check, REPORT_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [hasLocation, roomId]);

  if (state === "no-location") {
    return (
      <p className="text-xs text-muted-foreground">
        {copy.presence.location.notSet}
        {canManage && ` ${copy.presence.location.notSetManage}`}
      </p>
    );
  }

  const canRetry = state === "denied" || state === "error";
  return (
    <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <span>{MESSAGE[state]}</span>
      {canRetry && (
        <button
          type="button"
          onClick={() => checkRef.current()}
          className="underline underline-offset-2 hover:text-foreground"
        >
          {copy.presence.location.retry}
        </button>
      )}
    </p>
  );
}
