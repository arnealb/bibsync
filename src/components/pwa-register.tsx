"use client";

import { useEffect } from "react";

/** Registers the service worker in production so the app is installable. */
export function PwaRegister() {
  useEffect(() => {
    if (
      process.env.NODE_ENV === "production" &&
      "serviceWorker" in navigator
    ) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // registration failed — the app still works, just not installable
      });
    }
  }, []);
  return null;
}
